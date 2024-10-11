<?php

namespace App\Policies;

use App\Models\User;
use App\Models\File;

class FilePolicy
{
    /**
     * Create a new policy instance.
     */
    public function __construct()
    {
        //
    }

    /** Determine if the given file belongs to the user. */
    public function belongsToUser(User $user, File $file): bool
    {
        return $user->id === $file->user_id;
    }
}