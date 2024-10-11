<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

/** 
* @property int $used
* @property int $cap
*/
class BucketStorage extends Model
{
    use HasFactory;

    protected $table = 'bucket_storage';

    protected $primaryKey = 'singleton_id';

    protected $fillable = [
        'used',
    ]; // cap not fillable

    public $timestamps = false;
}
