<?php

namespace App\Exceptions;

use Exception;

class StorageCapExceedableException extends Exception
{
    protected $limitType;
    protected $limit;

    public function __construct(string $limitType, int $limit)
    {
        $this->limitType = $limitType;
        $this->limit = $limit;
        parent::__construct("$limitType ($limit) storage limit would be exceeded");
    }

    public function getLimitType(): string
    {
        return $this->limitType;
    }

    public function getLimit(): int
    {
        return $this->limit;
    }
}