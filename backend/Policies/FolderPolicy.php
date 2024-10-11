<?php

namespace App\Policies;

use App\Models\User;
use App\Models\Folder;

class FolderPolicy
{
    /**
     * Create a new policy instance.
     */
    public function __construct()
    {
        //
    }

    /** Determine if the given folder belongs to the user. */
    public function belongsToUser(User $user, Folder $folder): bool
    {
        return $user->id === $folder->user_id;
    }
}
