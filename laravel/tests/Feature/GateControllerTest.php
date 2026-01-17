<?php

namespace Tests\Feature;

use App\Exceptions\SesameApiException;
use App\Models\GateLog;
use App\Services\SesameApiClient;
use Mockery;
use Tests\TestCase;

/**
 * Gate Controller Feature Tests
 *
 * Requirements: 9.1-9.5
 *
 * Note: These tests mock the database operations since SQLite driver is not available.
 */
class GateControllerTest extends TestCase
{
    private string $validDeviceId = '00000000-0000-0000-0000-000000000001';
    private string $validTaskId = '01234567-890a-bcde-f012-34567890abcd';

    protected function setUp(): void
    {
        parent::setUp();

        // Mock GateLog to avoid database operations
        $this->mockGateLog();

        // Mock SesameApiClient by default to prevent null apiKey errors
        $this->mockDefaultSesameClient();
    }

    protected function tearDown(): void
    {
        Mockery::close();
        parent::tearDown();
    }

    /**
     * Mock GateLog model to avoid database operations
     */
    private function mockGateLog(): void
    {
        $mockGateLog = Mockery::mock('alias:' . GateLog::class);
        $mockGateLog->shouldReceive('create')->andReturn(new \stdClass());
        $mockGateLog->shouldReceive('query')->andReturnSelf();
        $mockGateLog->shouldReceive('where')->andReturnSelf();
        $mockGateLog->shouldReceive('count')->andReturn(0);
        $mockGateLog->shouldReceive('orderBy')->andReturnSelf();
        $mockGateLog->shouldReceive('skip')->andReturnSelf();
        $mockGateLog->shouldReceive('take')->andReturnSelf();
        $mockGateLog->shouldReceive('get')->andReturn(collect([]));
    }

    /**
     * Mock default SesameApiClient to prevent null apiKey errors
     */
    private function mockDefaultSesameClient(): void
    {
        $mockClient = Mockery::mock(SesameApiClient::class);
        $mockClient->shouldReceive('unlock')->andReturn(['task_id' => $this->validTaskId]);
        $mockClient->shouldReceive('lock')->andReturn(['task_id' => $this->validTaskId]);
        $mockClient->shouldReceive('getStatus')->andReturn([
            'locked' => true,
            'battery' => 85,
            'responsive' => true,
        ]);
        $mockClient->shouldReceive('waitForTaskCompletion')->andReturn([
            'status' => 'terminated',
            'successful' => true,
        ]);

        $this->app->instance(SesameApiClient::class, $mockClient);
    }

    /**
     * @test
     * Requirements: 9.1, 9.2, 9.3
     */
    public function unlock_endpoint_returns_success_response(): void
    {
        $mockClient = Mockery::mock(SesameApiClient::class);
        $mockClient->shouldReceive('unlock')
            ->once()
            ->with($this->validDeviceId)
            ->andReturn(['task_id' => $this->validTaskId]);

        $mockClient->shouldReceive('waitForTaskCompletion')
            ->once()
            ->with($this->validTaskId, 30, 500)
            ->andReturn(['status' => 'terminated', 'successful' => true]);

        $this->app->instance(SesameApiClient::class, $mockClient);

        $response = $this->postJson('/api/gate/unlock', [
            'device_id' => $this->validDeviceId,
            'license_plate' => '品川330あ1234',
            'recognition_confidence' => 95.5,
        ]);

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'message' => 'ゲートを解錠しました',
            ])
            ->assertJsonStructure([
                'success',
                'message',
                'data' => [
                    'device_id',
                    'task_id',
                    'license_plate',
                    'unlocked_at',
                ],
            ]);
    }

    /**
     * @test
     * Requirements: 9.2
     */
    public function unlock_endpoint_validates_device_id(): void
    {
        $response = $this->postJson('/api/gate/unlock', [
            'device_id' => 'invalid-uuid',
        ]);

        $response->assertStatus(422)
            ->assertJson([
                'success' => false,
                'error' => [
                    'code' => 'VALIDATION_ERROR',
                ],
            ]);
    }

    /**
     * @test
     * Requirements: 9.2
     */
    public function unlock_endpoint_requires_device_id(): void
    {
        $response = $this->postJson('/api/gate/unlock', []);

        $response->assertStatus(422)
            ->assertJson([
                'success' => false,
                'error' => [
                    'code' => 'VALIDATION_ERROR',
                ],
            ]);
    }

    /**
     * @test
     * Requirements: 9.4
     */
    public function unlock_endpoint_handles_sesame_api_connection_failure(): void
    {
        $mockClient = Mockery::mock(SesameApiClient::class);
        $mockClient->shouldReceive('unlock')
            ->once()
            ->andThrow(SesameApiException::connectionFailed(
                'Connection refused',
                ['endpoint' => '/sesame/' . $this->validDeviceId]
            ));

        $this->app->instance(SesameApiClient::class, $mockClient);

        $response = $this->postJson('/api/gate/unlock', [
            'device_id' => $this->validDeviceId,
        ]);

        $response->assertStatus(503)
            ->assertJson([
                'success' => false,
                'error' => [
                    'code' => 'CONNECTION_FAILED',
                ],
            ]);
    }

    /**
     * @test
     * Requirements: 9.4
     */
    public function unlock_endpoint_handles_device_not_found(): void
    {
        $mockClient = Mockery::mock(SesameApiClient::class);
        $mockClient->shouldReceive('unlock')
            ->once()
            ->andThrow(SesameApiException::deviceNotFound($this->validDeviceId));

        $this->app->instance(SesameApiClient::class, $mockClient);

        $response = $this->postJson('/api/gate/unlock', [
            'device_id' => $this->validDeviceId,
        ]);

        $response->assertStatus(404)
            ->assertJson([
                'success' => false,
                'error' => [
                    'code' => 'DEVICE_NOT_FOUND',
                ],
            ]);
    }

    /**
     * @test
     * Requirements: 9.4
     */
    public function unlock_endpoint_handles_timeout(): void
    {
        $mockClient = Mockery::mock(SesameApiClient::class);
        $mockClient->shouldReceive('unlock')
            ->once()
            ->andThrow(SesameApiException::timeout(
                'Request timeout',
                ['endpoint' => '/sesame/' . $this->validDeviceId]
            ));

        $this->app->instance(SesameApiClient::class, $mockClient);

        $response = $this->postJson('/api/gate/unlock', [
            'device_id' => $this->validDeviceId,
        ]);

        $response->assertStatus(504)
            ->assertJson([
                'success' => false,
                'error' => [
                    'code' => 'TIMEOUT',
                ],
            ]);
    }

    /**
     * @test
     * Requirements: 9.4
     */
    public function unlock_endpoint_handles_task_failure(): void
    {
        $mockClient = Mockery::mock(SesameApiClient::class);
        $mockClient->shouldReceive('unlock')
            ->once()
            ->andReturn(['task_id' => $this->validTaskId]);

        $mockClient->shouldReceive('waitForTaskCompletion')
            ->once()
            ->andReturn([
                'status' => 'terminated',
                'successful' => false,
                'error' => 'Device battery low',
            ]);

        $this->app->instance(SesameApiClient::class, $mockClient);

        $response = $this->postJson('/api/gate/unlock', [
            'device_id' => $this->validDeviceId,
        ]);

        $response->assertStatus(500)
            ->assertJson([
                'success' => false,
                'error' => [
                    'code' => 'UNLOCK_FAILED',
                ],
            ]);
    }

    /**
     * @test
     */
    public function status_endpoint_returns_device_status(): void
    {
        $mockClient = Mockery::mock(SesameApiClient::class);
        $mockClient->shouldReceive('getStatus')
            ->once()
            ->with($this->validDeviceId)
            ->andReturn([
                'locked' => true,
                'battery' => 85,
                'responsive' => true,
            ]);

        $this->app->instance(SesameApiClient::class, $mockClient);

        $response = $this->getJson("/api/gate/status/{$this->validDeviceId}");

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data' => [
                    'device_id' => $this->validDeviceId,
                    'locked' => true,
                    'battery' => 85,
                    'responsive' => true,
                ],
            ]);
    }

    /**
     * @test
     */
    public function status_endpoint_validates_device_id_format(): void
    {
        $response = $this->getJson('/api/gate/status/invalid-uuid');

        $response->assertStatus(422)
            ->assertJson([
                'success' => false,
                'error' => [
                    'code' => 'VALIDATION_ERROR',
                ],
            ]);
    }

    /**
     * @test
     * Requirements: 9.5
     */
    public function logs_endpoint_returns_gate_logs(): void
    {
        $response = $this->getJson('/api/gate/logs');

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
            ])
            ->assertJsonStructure([
                'success',
                'data' => [
                    'logs',
                    'pagination' => [
                        'total',
                        'limit',
                        'offset',
                    ],
                ],
            ]);
    }

    /**
     * @test
     * Requirements: 9.5
     */
    public function logs_endpoint_validates_parameters(): void
    {
        $response = $this->getJson('/api/gate/logs?limit=invalid');

        $response->assertStatus(422)
            ->assertJson([
                'success' => false,
                'error' => [
                    'code' => 'VALIDATION_ERROR',
                ],
            ]);
    }

    /**
     * @test
     * Requirements: 9.5
     */
    public function logs_endpoint_validates_operation_parameter(): void
    {
        $response = $this->getJson('/api/gate/logs?operation=invalid');

        $response->assertStatus(422)
            ->assertJson([
                'success' => false,
                'error' => [
                    'code' => 'VALIDATION_ERROR',
                ],
            ]);
    }
}
