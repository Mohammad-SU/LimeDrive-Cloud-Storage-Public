<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use App\Http\Helpers;

class BucketStorageSeeder extends Seeder
{
    // In Decimal as r2 uses decimal. Leave same in dev db to prevent issues (a check is there before file uploads anyways)
    private const BUCKET_STORAGE_DB_CAP = 9 * 1000 * 1000 * 1000; 

    public function run(): void
    {
        DB::table('bucket_storage')->truncate();

        $totalUserBucketStorageUsed = User::sum('user_bucket_storage_used');
    
        DB::table('bucket_storage')->insert([
            'singleton_id' => 1,
            'used' => $totalUserBucketStorageUsed,
            'cap' => self::BUCKET_STORAGE_DB_CAP,
        ]);
    }
}
