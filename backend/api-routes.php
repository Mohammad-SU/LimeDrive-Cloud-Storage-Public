<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

use App\Http\Controllers\Account\AuthController;
use App\Http\Controllers\Account\UserController;

use App\Http\Controllers\ItemManagement\UploadController;
use App\Http\Controllers\ItemManagement\MoveItemsController;
use App\Http\Controllers\ItemManagement\DeleteItemsController;

use App\Http\Controllers\ItemContent\FileViewingController;
use App\Http\Controllers\ItemContent\ItemDownloadController;
use App\Http\Controllers\ItemContent\FileShareKeyController;

use App\Http\Controllers\TestController;
use App\Http\Helpers;

/*
|--------------------------------------------------------------------------
| API Routes
|--------------------------------------------------------------------------
|
| Here is where you can register API routes for your application. These
| routes are loaded by the RouteServiceProvider and all of them will
| be assigned to the "api" middleware group. Make something great!
|
*/
Route::group(['middleware' => ['auth:sanctum', 'throttle:60,1']], function () { // Rate limting for authenticated routes is based on user data rather than IP so this can be more strict since it's not shared like IP rate limting may be
    Route::get('/getUserData', [UserController::class, 'getUserData']);
    Route::post('/saveConsentChoice', [UserController::class, 'saveConsentChoice']);
    Route::post('/logout', [UserController::class, 'logout']);

    Route::post('/updateUsername', [UserController::class, 'updateUsername']);
    Route::post('/updateEmail', [UserController::class, 'updateEmail']);
    Route::post('/updatePassword', [UserController::class, 'updatePassword']);

    Route::get('/restoreSamples', [UserController::class, 'restoreSamples']);
    Route::delete('/deleteAccount', [UserController::class, 'deleteAccount']);

    Route::post('/uploadFileMetadata', [UploadController::class, 'uploadFileMetadata']);
    Route::post('/confirmFileUploadToBucket', [UploadController::class, 'confirmFileUploadToBucket']);
    Route::post('/createFolder', [UploadController::class, 'createFolder']);

    Route::post('/moveItems', [MoveItemsController::class, 'moveItems']);

    Route::get('/getFileViewingUrl', [FileViewingController::class, 'getFileViewingUrl']);

    Route::get('/getFileAccessTokens', [FileShareKeyController::class, 'getFileAccessTokens']); // Don't add extra throttle to this than the one it already has
    Route::delete('/deleteFileShareKeys', [FileShareKeyController::class, 'deleteFileShareKeys']);

    Route::post('/getItemDownload', [ItemDownloadController::class, 'getItemDownload']); // Leave as post since LinkShare version uses post too

    Route::delete('/deleteItems', [DeleteItemsController::class, 'deleteItems']);
});

// Increased rate limit for aunauthenticated routes - multiple users may share the same IP on privacy-enabling proxies which is used for unauthenticated rate-limting, and these routes aren't super resource-intensive anyways
Route::group(['middleware' => ['throttle:120,1']], function () { 
    Route::post('/register', [AuthController::class, 'register']);
    Route::post('/login', [AuthController::class, 'login']);

    Route::get('/getGeneratedUser', [AuthController::class, 'getGeneratedUser'])
        ->middleware(Helpers::isEnvLocal() ? 'throttle:120,1' : 'throttle:8,1'); // Limit higher than frontend cooldown as throttle may seem stricter than it should be

    // Excluded from csrf
    Route::post('/verifyEmail', [AuthController::class, 'verifyEmail']);
    
    // Use post here since data is sensitive, although user doesnt need to be logged in
    // Excluded from csrf
    Route::post('/getLinkShareFileViewingUrl', [FileViewingController::class, 'getLinkShareFileViewingUrl']);
    Route::post('/getLinkShareFileDownload', [ItemDownloadController::class, 'getLinkShareFileDownload']);

    // Route::post('/registerTestUser', [TestController::class, 'registerTestUser']);
    // Route::post('/loginTestUser', [TestController::class, 'loginTestUser']);
});