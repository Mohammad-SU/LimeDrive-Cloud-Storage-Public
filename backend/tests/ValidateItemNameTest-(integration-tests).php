<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Tests\TestCase;
use Illuminate\Validation\ValidationException;
use Illuminate\Testing\TestResponse;

// Some of these integration tests have some issues but I left it as I spent a while on it

class ValidateItemNameTest extends TestCase
{
    use DatabaseTransactions;

    /** @var \Illuminate\Contracts\Auth\Authenticatable $user */
    private User $user;

    protected function setUp(): void
    {
        $this->markTestIncomplete();
        parent::setUp();
        $this->user = User::factory()->create();
    }

    /**
     * @dataProvider validNameProvider
     */
    public function testValidItemNamesForFileUpload($name)
    {
        $response = $this->actingAs($this->user)->postJson('/api/uploadFileMetadata', [
            'name' => $name,
            'size' => 1024,
            'type' => 'text/plain'
        ]);

        if ($response->status() !== 200) {
            $this->fail('Response status is not 200. Content: ' . $response->content());
        }

        $response->assertStatus(200);
        $this->assertDatabaseHas('files', ['name' => trim($name)]);
    }

    /**
     * @dataProvider validNameProvider
     */
    public function testValidItemNamesForFolderCreation($name)
    {
        $response = $this->actingAs($this->user)->postJson('/api/createFolder', [
            'name' => $name,
            'parentFolderId' => null,
        ]);

        if ($response->status() !== 200) {
            $this->fail('Response status is not 200. Content: ' . $response->content());
        }

        $response->assertStatus(200);
        $this->assertDatabaseHas('folders', ['name' => trim($name)]);
    }

    /**
     * @dataProvider invalidNameProvider
     */
    public function testInvalidItemNamesForFileUpload($name)
    {
        $response = $this->actingAs($this->user)->postJson('/api/uploadFileMetadata', [
            'name' => $name,
            'size' => 1024,
            'type' => 'text/plain',
        ]);

        if ($response->status() !== 422) {
            $this->fail('Response status is not 422. Content: ' . $response->content());
        }

        $response->assertStatus(422);
        $this->assertDatabaseMissing('files', ['name' => $name]);
    }

    /**
     * @dataProvider invalidNameProvider
     */
    public function testInvalidItemNamesForFolderCreation($name)
    {
        $response = $this->actingAs($this->user)->postJson('/api/createFolder', [
            'name' => $name,
        ]);

        if ($response->status() !== 422) {
            $this->fail('Response status is not 422. Content: ' . $response->content());
        }
        
        $response->assertStatus(422);
        $this->assertDatabaseMissing('folders', ['name' => $name]);
    }

    public static function validNameProvider()
    {
        return [
            ['valid_name.txt'],
            ['name with spaces.jpg'],
            ['файл.pdf'],
            ['name`with¦special~characters!.docx'],
            ["item​name.txt"], // Zero-width space between 'item' and 'name' (should be valid as it won't be trimmed)
            ['no_extension'],
            ['  trailingspaces_name.txt   '],
        ];
    }

    public static function invalidNameProvider()
    {
        return [
            [''],
            [str_repeat('a', 256)],
            ['invalid_n/a/me.txt'],
            ['​'], // Zero-width space alone (Should be invalid as it will be trimmed)
        ];
    }
}