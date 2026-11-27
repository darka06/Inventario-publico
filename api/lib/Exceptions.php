<?php
declare(strict_types=1);

// Excepciones específicas para la API de Inventario.
// El patrón principal de error en este códigobase es usar sendJson() directamente
// (que termina la ejecución), pero estas excepciones permiten casos especiales.

class ApiException extends RuntimeException
{
    private int $httpStatus;
    private array $payload;

    public function __construct(string $message, int $httpStatus = 500, array $payload = [])
    {
        parent::__construct($message);
        $this->httpStatus = $httpStatus;
        $this->payload = $payload;
    }

    public function getHttpStatus(): int
    {
        return $this->httpStatus;
    }

    public function getPayload(): array
    {
        return $this->payload;
    }
}

class ValidationException extends ApiException
{
    public function __construct(string $message, array $payload = [])
    {
        parent::__construct($message, 422, $payload);
    }
}

class NotFoundException extends ApiException
{
    public function __construct(string $message, array $payload = [])
    {
        parent::__construct($message, 404, $payload);
    }
}

class ConflictException extends ApiException
{
    public function __construct(string $message, array $payload = [])
    {
        parent::__construct($message, 409, $payload);
    }
}
