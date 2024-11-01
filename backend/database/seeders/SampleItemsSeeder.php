<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class SampleItemsSeeder extends Seeder
{
    public function run(): void
    {
        DB::table('sample_folders')->truncate();
        DB::table('sample_files')->truncate();

        // Sample folders main data
        /** @var array<int, array{name: string, app_path: string, id?: int}> */
        $folders = [
            ['name' => 'Samples', 'app_path' => 'LimeDrive/Samples'],
            ['name' => 'Documents', 'app_path' => 'LimeDrive/Samples/Documents'],
            ['name' => 'Videos', 'app_path' => 'LimeDrive/Samples/Videos'],
            ['name' => 'Images', 'app_path' => 'LimeDrive/Samples/Images'],
        ];

        // Insert folders and capture the inserted IDs (don't batch)
        foreach ($folders as &$folder) {
            $folder['id'] = DB::table('sample_folders')->insertGetId([ // Insert based on table since model is restricted
                'name' => $folder['name'],
                'app_path' => $folder['app_path']
            ]);
        }

        // Update sample parent folder IDs based on app_path
        foreach ($folders as &$folder) {
            if ($folder['app_path'] !== 'LimeDrive/Samples') {
                $parentPath = dirname($folder['app_path']);
                $parentFolder = DB::table('sample_folders')->where('app_path', $parentPath)->first();

                if ($parentFolder && isset($folder['id'])) {
                    /** @var object{id: int} $parentFolder */
                    DB::table('sample_folders')->where('id', $folder['id'])->update(['sample_parent_folder_id' => $parentFolder->id]);
                }
            }
        }

        // Sample files main data
        $files = [
            ['name' => 'Welcome Readme.html', 'app_path' => 'LimeDrive/Welcome Readme.html', 'type' => 'text/html', 'size' => '3990', 'media_duration' => null],
            ['name' => 'Space.jpg', 'app_path' => 'LimeDrive/Samples/Images/Space.jpg', 'type' => 'image/jpeg', 'size' => '728977', 'media_duration' => null],
            ['name' => 'Field.bmp', 'app_path' => 'LimeDrive/Samples/Images/Field.bmp', 'type' => 'image/bmp', 'size' => '3275658', 'media_duration' => null],
            ['name' => 'Flower.gif', 'app_path' => 'LimeDrive/Samples/Images/Flower.gif', 'type' => 'image/gif', 'size' => '2588417', 'media_duration' => null],
            ['name' => 'Machine Learning.pdf', 'app_path' => 'LimeDrive/Samples/Documents/Machine Learning.pdf', 'type' => 'application/pdf', 'size' => '2234389', 'media_duration' => null],
            ['name' => 'Jellyfish.mp4', 'app_path' => 'LimeDrive/Samples/Videos/Jellyfish.mp4', 'type' => 'video/mp4', 'size' => '3634762', 'media_duration' => 10.744066666667],
            ['name' => 'Driving.mp4', 'app_path' => 'LimeDrive/Samples/Videos/Driving.mp4', 'type' => 'video/mp4', 'size' => '12445322', 'media_duration' => 49.386666666667],
            ['name' => 'Earth.webm', 'app_path' => 'LimeDrive/Samples/Videos/Earth.webm', 'type' => 'video/webm', 'size' => '3667214', 'media_duration' => 30.543],
            ['name' => 'Mystery.zip', 'app_path' => 'LimeDrive/Samples/Mystery.zip', 'type' => 'application/x-zip-compressed', 'size' => '595478', 'media_duration' => null],
            ['name' => 'Summer.mp3', 'app_path' => 'LimeDrive/Samples/Summer.mp3', 'type' => 'audio/mpeg', 'size' => '4663588', 'media_duration' => 145.737125],
            ['name' => 'Chicken.pdf', 'app_path' => 'LimeDrive/Samples/Chicken.pdf', 'type' => 'application/pdf', 'size' => '51500', 'media_duration' => null],
            ['name' => 'Bonfire.mp4', 'app_path' => 'LimeDrive/Samples/Bonfire.mp4', 'type' => 'video/mp4', 'size' => '5004894', 'media_duration' => 20.521666666667],
            ['name' => 'Lime Pie Recipe.txt', 'app_path' => 'LimeDrive/Samples/Documents/Lime Pie Recipe.txt', 'type' => 'text/plain', 'size' => '2921', 'media_duration' => null],
            ['name' => 'Code.js', 'app_path' => 'LimeDrive/Samples/Documents/Code.js', 'type' => 'text/javascript', 'size' => '3966', 'media_duration' => null],
        ];

        // Set the correct sample parent folder IDs and then insert individually (batch insert caused issue)
        foreach ($files as &$file) {
            if ($file['app_path'] !== 'LimeDrive/Welcome Readme.html') { // Don't return early since this still needs to be inserted
                $parentPath = dirname($file['app_path']);
                $parentFolder = DB::table('sample_folders')->where('app_path', $parentPath)->first();
                
                if ($parentFolder) {
                    /** @var object{id: int} $parentFolder */
                    $file['sample_parent_folder_id'] = $parentFolder->id;
                }
            }
            
            DB::table('sample_files')->insert($file);
        }
    }
}
