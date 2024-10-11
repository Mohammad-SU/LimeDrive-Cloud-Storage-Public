<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
/**
 * @property int $id
 * @property int $user_id
 * @property int $parent_folder_id
 * @property string $name
 * @property string $app_path
 * @property string $created_at
 * @property bool $is_sample
 */
class Folder extends Model
{
    use HasFactory;

    protected $table = 'folders';

    protected $fillable = [
        'user_id',
        'parent_folder_id',
        'name',
        'app_path', 
        'created_at'
    ];

    public $timestamps = false;

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }
}
