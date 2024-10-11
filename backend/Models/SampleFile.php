<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

/**
 * @property int $id
 * @property int $sample_parent_folder_id
 * @property string $name
 * @property string $app_path
 * @property string $type
 * @property int $size
 * @property ?int $media_duration
 */
class SampleFile extends Model
{
    use HasFactory;

    protected $table = 'sample_files';

    protected $fillable = []; // Don't make it fillable yet - not needed yet

    public $timestamps = false;
}
