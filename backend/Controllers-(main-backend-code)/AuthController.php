<?php

namespace App\Http\Controllers\Account;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use App\Mail\VerifyEmail;
use Illuminate\Support\Facades\Validator;
use Illuminate\Http\JsonResponse;
use App\Models\User;
use Exception;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\Log;
use App\Http\Helpers;

class AuthController extends Controller
{
    public function register(Request $request): JsonResponse
    {
        $request->validate([
            'usernameReg' => 'required|regex:/^[a-zA-Z0-9_-]+$/|unique:users,username|max:30',
            'emailReg' => 'required|email|unique:users,email|max:255',
            'passwordReg' => 'required|ext_password_format|confirmed',
        ], [            
            'emailReg.unique' => 'Email is taken.',
            'usernameReg.unique' => 'Username is taken.',
        ]);

        $email = $request['emailReg'];
        $verifyEmailKey = Str::random(20); // Cryptographically secure (uses PHP random_bytes). Don't use more than 20 chars otherwise encrypted key may be too long.
    
        try {
            DB::beginTransaction();

            $user = $this->createAccount($email, $request['usernameReg'], $request['passwordReg'], $verifyEmailKey);
        
            Auth::login($user);

            DB::commit();

            // Put this after DB commit (not a big deal for now if verification fails to send as it doesn't really grant extra permissions anyway)
            $userId = $user->id;
            $verifyEmailUrl = "https://limedrive.net/verify-email?id=$userId&key=$verifyEmailKey";

            Mail::to($email)->send(new VerifyEmail($verifyEmailUrl, true)); // Use StyledRegistrationConfirmation() after it's fixed with MJML? Research how to use MJML with blade/laravel

            // Refresh user otherwise account storage cap may be sent back null
            return $this->createSessionAndUserDataResponse($request, $user->refresh());
        }
        catch (Exception $e) {
            DB::rollBack();

            $request->session()->invalidate();
            $request->session()->regenerateToken();

            Log::error($e);
            return response()->json(['message' => "Something went wrong."], 500);
        }
    }
    
    public function login(Request $request): JsonResponse
    {       
        try {
            $credentials = $request->all();

            $validator = Validator::make($credentials, [
                'usernameOrEmailLog' => 'required|string|max:255',
                'passwordLog' => 'required|ext_password_format', // Don't use ext_correct_password custom rule here since user is not authenticated
            ]);
    
            if ($validator->fails()) {
                return response()->json(['message' => 'Invalid login details.'], 400);
            }
    
            $isEmail = filter_var($credentials['usernameOrEmailLog'], FILTER_VALIDATE_EMAIL);
    
            $usernameOrEmailField = $isEmail ? 'email' : 'username'; // User can input username OR email for login
            $usernameOrEmailValue = $credentials['usernameOrEmailLog'];
    
            $normalizedCredentials = [
                $usernameOrEmailField => $usernameOrEmailValue,
                'password' => $credentials['passwordLog']
            ];
    
            if (Auth::attempt($normalizedCredentials)) {
                return $this->createSessionAndUserDataResponse($request, auth()->user());
            } else {
                return response()->json(['message' => 'Invalid login details.'], 400);
            }
        } 
        catch (Exception $e) {
            Log::error($e);

            $request->session()->invalidate();
            $request->session()->regenerateToken();
            
            return response()->json(['message' => "Something went wrong."], 400);
        }
    }

    private function createSessionAndUserDataResponse(Request $request, User $user, string $password = null): JsonResponse
    {
        $request->session()->regenerate();

        // Password is only sent initially if account was generated. For more details check comment in getGeneratedUser.
        return $user->returnUserDataResponse($password);
    }

    public function getGeneratedUser(Request $request): JsonResponse
    {
        try {
            $username = $this->generateUsername();
            $password = $this->generatePassword(); // Passphrase may be more secure and memorable, but it can also be longer than normal password. Stick to password

            DB::beginTransaction();

            $user = $this->createAccount(null, $username, $password, null);

            Auth::login($user); // User should be logged in after generation

            DB::commit();
            
            // generated password is only sent after initial account generation if user used 'skip for now' option in auth
            // so that they can save the generated password if they want. It will never be shown to them again afterwards.
            // Refresh user otherwise account storage cap may be sent back null
            return $this->createSessionAndUserDataResponse($request, $user->refresh(), $password);

        } catch (Exception $e) {
            DB::rollBack();
            Log::error($e);
            return response()->json(['message' => "Something went wrong."], 500);
        }
    }

    private function generateUsername(): string
    {
        $maxAttempts = 10; // Prevent infinite loop
        $attempt = 0;

        do {
            $adjectives = config('username_dict.adjectives');
            $nouns = config('username_dict.nouns');
    
            $adjective = $adjectives[array_rand($adjectives)];
            $noun = $nouns[array_rand($nouns)];
    
            $number = rand(0, 999); // Don't need random_int which may be slower, rand would make number unique enough
    
            $username = $adjective . '-' . $noun . $number;
    
            $conflict = User::where('username', $username)->exists(); // uq key for username is already on table so another index isn't needed

            $attempt++;
        } 
        while (($conflict || strlen($username) > 30) && $attempt < $maxAttempts);

        if ($conflict || strlen($username) > 30) { // Handle the case where a unique username was not found within the allowed attempts
            throw new \Exception('Unable to generate a unique username after ' . $maxAttempts . ' attempts.');
        }

        return $username;
    }

    private function generatePassword(): string
    {
        $characters = Str::random(12); // 12 chars is good enough to balance UX and security
            
        $chunks = str_split($characters, 3); // Split into chunks and join with dash for UX
        
        return implode('-', $chunks);
    }

    private function createAccount(?string $email, $username, $password, ?string $verifyEmailKey): User
    {
        $user = User::query()->create([
            'email' => $email ?? null,
            'username' => $username,
            'password' => Hash::make($password),
            'enc_verify_email_key' =>  $email ? Crypt::encryptString($verifyEmailKey) : null // Doesn't need to be unique since the key will have the user's auto-incremented ID in it.
        ]);

        $user->transferSampleItems();

        return $user;
    }

    public function verifyEmail(Request $request): JsonResponse
    {
        try {
            $validator = Validator::make($request->all(), [
                'userId' => 'required|integer|ext_max_length',
                'verifyEmailKey' => 'required|string|max:255',
            ]);
    
            if ($validator->fails()) {
                throw new Exception("Invalid verification link.");
            }

            $user = Helpers::getUserOrFail($request['userId']); // User wouldn't be logged in so query database. int for larastan

            if ($user->is_email_verified) {
                throw New Exception("Email already verified.");
            }
            else if (Crypt::decryptString($user->enc_verify_email_key) !== $request['verifyEmailKey']) {
                throw New Exception("Invalid verification link.");
            }

            DB::beginTransaction();

            // Currently no expiration, as verifying currently doesn't log the user in or do much else
            $user->update(['enc_verify_email_key' => null]);
            $user->update(['is_email_verified' => true]);

            DB::commit();
            return response()->json(['message' => "Email verified successfully."]);
        } 
        catch (Exception $e) {
            DB::rollBack();
            Log::error($e);
            $errorMsg = $e->getMessage();
            
            if ($e instanceof \Illuminate\Database\Eloquent\ModelNotFoundException || $errorMsg === "Invalid verification link.") {
                return response()->json(['message' => "Invalid verification link."], 400); // If user not found still say it's invalid link rather than saying user not found, for security
            } 
            else if ($errorMsg === "Email already verified.") {
                return response()->json(['message' => $errorMsg], 400);
            }
            else {
                return response()->json(['message' => "Something went wrong."], 500);
            }
        }
    }
}