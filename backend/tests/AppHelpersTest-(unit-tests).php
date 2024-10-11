<?php

namespace Tests\Unit\AppHelpersTests;

use App\Http\Helpers;
use Tests\TestCase;

class AppHelpersTest extends TestCase
{
    public function testIsFileIdFormat()
    {
        $this->assertTrue(Helpers::isFileIdFormat('62724'));
        $this->assertTrue(Helpers::isFileIdFormat(2938));
        $this->assertTrue(Helpers::isFileIdFormat('1285099'));
        $this->assertFalse(Helpers::isFileIdFormat('d_3729'));
        $this->assertFalse(Helpers::isFileIdFormat('abc'));
        $this->assertFalse(Helpers::isFileIdFormat(''));
    }

    public function testIsFrontendFolderIdFormat()
    {
        $this->assertTrue(Helpers::isFrontendFolderIdFormat('d_3729'));
        $this->assertTrue(Helpers::isFrontendFolderIdFormat('d_1193'));
        $this->assertTrue(Helpers::isFrontendFolderIdFormat('d_41836'));
        $this->assertFalse(Helpers::isFrontendFolderIdFormat('3729'));
        $this->assertFalse(Helpers::isFrontendFolderIdFormat('d_'));
        $this->assertFalse(Helpers::isFrontendFolderIdFormat('d_abc'));
    }

    public function testConvertToParentFolderDbId()
    {
        $this->assertNull(Helpers::convertToParentFolderDbId(null));
        $this->assertEquals(3729, Helpers::convertToParentFolderDbId('d_3729'));
        $this->assertEquals(1193, Helpers::convertToParentFolderDbId('d_1193'));
        $this->assertEquals(41836, Helpers::convertToParentFolderDbId('d_41836'));
    }

    public function testConvertToFrontendParentFolderId()
    {
        $this->assertNull(Helpers::convertToFrontendParentFolderId(null));
        $this->assertEquals('d_3729', Helpers::convertToFrontendParentFolderId(3729));
        $this->assertEquals('d_1193', Helpers::convertToFrontendParentFolderId(1193));
        $this->assertEquals('d_41836', Helpers::convertToFrontendParentFolderId(41836));
    }

    public function testConvertToFolderDbId()
    {
        $this->assertEquals(3729, Helpers::convertToFolderDbId('d_3729'));
        $this->assertEquals(1193, Helpers::convertToFolderDbId('d_1193'));
        $this->assertEquals(41836, Helpers::convertToFolderDbId('d_41836'));
    }

    public function testConvertFrontendItemIdsToDbIds()
    {
        $input = ['62724', 'd_3729', '2938', 'd_1193'];
        $expected = [
            'fileIds' => [62724, 2938],
            'folderIds' => [3729, 1193]
        ];
        $this->assertEquals($expected, Helpers::convertFrontendItemIdsToDbIds($input));

        $this->expectException(\Exception::class);
        Helpers::convertFrontendItemIdsToDbIds(['invalid_id']);
    }

    public function testArrToSnake()
    {
        $input = ['camelCase' => 1, 'PascalCase' => 2, 'snake_case' => 3];
        $expected = ['camel_case' => 1, 'pascal_case' => 2, 'snake_case' => 3];
        $this->assertEquals($expected, Helpers::arrToSnake($input));
    }

    public function testArrToCamel()
    {
        $input = ['snake_case' => 1, 'camelCase' => 2, 'PascalCase' => 3];
        $expected = ['snakeCase' => 1, 'camelCase' => 2, 'pascalCase' => 3];
        $this->assertEquals($expected, Helpers::arrToCamel($input));
    }

    public function testIsEnvLocal()
    {
        // This test depends on the current environment setting
        $expectedResult = (config('app.env') === "local");
        $this->assertEquals($expectedResult, Helpers::isEnvLocal());
    }
}