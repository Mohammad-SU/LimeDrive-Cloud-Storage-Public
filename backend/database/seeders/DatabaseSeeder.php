<?php

namespace Database\Seeders;

// use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        try {
            DB::beginTransaction();
            
            $this->call(SampleItemsSeeder::class);
            $this->call(BucketStorageSeeder::class);

            DB::commit();
        }
        catch (\Exception $e) {
            DB::rollBack();
            Log::error($e);
        }
    }
}
