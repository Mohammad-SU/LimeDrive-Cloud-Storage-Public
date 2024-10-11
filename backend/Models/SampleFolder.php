<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

/**
 * @property int $id
 * @property int $sample_parent_folder_id
 * @property string $name
 * @property string $app_path
 */
class SampleFolder extends Model
{
    use HasFactory;

    protected $table = 'sample_folders';

    protected $fillable = []; // Don't make it fillable yet - not needed yet

    public $timestamps = false;
}
