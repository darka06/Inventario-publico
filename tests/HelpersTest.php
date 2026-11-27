<?php
declare(strict_types=1);

namespace Inventario\Tests;

use PHPUnit\Framework\TestCase;
use ApiException;

class HelpersTest extends TestCase
{
    public function testNewSourceKeyGeneratesUniqueKeys()
    {
        $key1 = newSourceKey();
        $key2 = newSourceKey();

        $this->assertStringStartsWith('API:', $key1);
        $this->assertStringStartsWith('API:', $key2);
        $this->assertNotEquals($key1, $key2);
        $this->assertEquals(44, strlen($key1)); // 'API:' + 20 bytes hex = 4 + 40 = 44
    }

    public function testValidDateAcceptsValidFormat()
    {
        $result = validDate('2024-01-15');
        $this->assertEquals('2024-01-15', $result);
    }

    public function testValidDateRejectsInvalidFormat()
    {
        $this->expectException(ApiException::class);
        validDate('15-01-2024');
    }

    public function testValidDateRejectsEmpty()
    {
        // En nuestra implementación, '' se trata como null cuando no es required
        // Para rechazarlo, debe ser required=true
        $this->expectException(ApiException::class);
        validDate('', true);
    }

    public function testValidDateWithRequiredTrueRejectsNull()
    {
        $this->expectException(ApiException::class);
        validDate(null, true);
    }

    public function testValidDateWithRequiredFalseAcceptsNull()
    {
        $result = validDate(null, false);
        $this->assertNull($result);
    }

    public function testRequiredTextReturnsValue()
    {
        $result = requiredText(['name' => 'Test Name'], 'name', 100);
        $this->assertEquals('Test Name', $result);
    }

    public function testRequiredTextTrimsWhitespace()
    {
        $result = requiredText(['name' => '  Test Name  '], 'name', 100);
        $this->assertEquals('Test Name', $result);
    }

    public function testRequiredTextRejectsMissing()
    {
        $this->expectException(ApiException::class);
        requiredText(['other' => 'value'], 'name', 100);
    }

    public function testRequiredTextRejectsEmpty()
    {
        $this->expectException(ApiException::class);
        requiredText(['name' => ''], 'name', 100);
    }

    public function testRequiredTextRejectsTooLong()
    {
        $this->expectException(ApiException::class);
        requiredText(['name' => str_repeat('a', 101)], 'name', 100);
    }

    public function testOptionalTextReturnsValue()
    {
        $result = optionalText(['name' => 'Test Name'], 'name', 100);
        $this->assertEquals('Test Name', $result);
    }

    public function testOptionalTextReturnsNullWhenMissing()
    {
        $result = optionalText(['other' => 'value'], 'name', 100);
        $this->assertNull($result);
    }

    public function testOptionalTextReturnsNullWhenEmpty()
    {
        $result = optionalText(['name' => ''], 'name', 100);
        $this->assertNull($result);
    }

    public function testOptionalTextRejectsTooLong()
    {
        $this->expectException(ApiException::class);
        optionalText(['name' => str_repeat('a', 101)], 'name', 100);
    }
}
