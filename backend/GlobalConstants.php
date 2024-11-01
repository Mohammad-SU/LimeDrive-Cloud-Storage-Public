<?php

namespace App;

class GlobalConstants {
    /** @var array<string, mixed>|null */
    private static $constants = null;

    // Static block to load constants when the class is first accessed
    public static function initialize(): void
    {
        if (self::$constants === null) {
            $jsonPath = __DIR__ . '/../shared_constants.json'; // in backend root

            $json = file_get_contents($jsonPath);

            if ($json === false) {
                throw new \Exception("Unable to read shared_constants.json");
            }

            self::$constants = json_decode($json, true);

            if (json_last_error() !== JSON_ERROR_NONE) {
                throw new \Exception("Error decoding shared_constants.json: " . json_last_error_msg());
            }

            // Dynamically calculate MAX_USER_ITEM_NUM
            self::$constants['MAX_USER_ITEM_NUM'] = self::$constants['MAX_USER_FILE_NUM'] + self::$constants['MAX_USER_FOLDER_NUM'];
        }
    }

    public static function get(string $name): mixed
    {
        self::initialize();
        return self::$constants[$name] ?? null;
    }
}

// Initialize the constants when the script is included
GlobalConstants::initialize();
