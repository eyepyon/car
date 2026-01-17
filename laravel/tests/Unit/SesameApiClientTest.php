<?php

namespace Tests\Unit;

use App\Exceptions\SesameApiException;
use App\Services\SesameApiClient;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

/**
 * Sesame API Client Unit Tests
 *
 * Requirements: 9.1, 9.4
 */
class SesameApiClientTest extends TestCase
{
    private string $validDeviceId = '00000000-0000-0000-0000-000000000001';
    private string $validTaskId = '01234567-890a-bcde-f012-34567890abcd';

    /**
     * @test
     */
    public function get_sesame_list_returns_devices(): void
    {
        Http::fake([
            'api.candyhouse.co/public/sesames' => Http::response([
                [
                    'device_id' => $this->validDeviceId,
                    'serial' => 'ABC1234567',
                    'nickname' => 'Front door',
                ],
            ], 200),
        ]);

        $client = new SesameApiClient('test-api-key');
        $result = $client->getSesameList();

        $this->assertCount(1, $result);
        $this->assertEquals($this->validDeviceId, $result[0]['device_id']);
    }

    /**
     * @test
     */
    public function get_status_returns_device_status(): void
    {
        Http::fake([
            "api.candyhouse.co/public/sesame/{$this->validDeviceId}" => Http::response([
                'locked' => true,
                'battery' => 85,
                'responsive' => true,
            ], 200),
        ]);

        $client = new SesameApiClient('test-api-key');
        $result = $client->getStatus($this->validDeviceId);

        $this->assertTrue($result['locked']);
        $this->assertEquals(85, $result['battery']);
        $this->assertTrue($result['responsive']);
    }

    /**
     * @test
     */
    public function get_status_throws_exception_when_device_offline(): void
    {
        Http::fake([
            "api.candyhouse.co/public/sesame/{$this->validDeviceId}" => Http::response([
                'locked' => true,
                'battery' => 85,
                'responsive' => false,
            ], 200),
        ]);

        $client = new SesameApiClient('test-api-key');

        $this->expectException(SesameApiException::class);
        $client->getStatus($this->validDeviceId);
    }

    /**
     * @test
     */
    public function unlock_returns_task_id(): void
    {
        Http::fake([
            "api.candyhouse.co/public/sesame/{$this->validDeviceId}" => Http::response([
                'task_id' => $this->validTaskId,
            ], 200),
        ]);

        $client = new SesameApiClient('test-api-key');
        $result = $client->unlock($this->validDeviceId);

        $this->assertEquals($this->validTaskId, $result['task_id']);
    }

    /**
     * @test
     */
    public function lock_returns_task_id(): void
    {
        Http::fake([
            "api.candyhouse.co/public/sesame/{$this->validDeviceId}" => Http::response([
                'task_id' => $this->validTaskId,
            ], 200),
        ]);

        $client = new SesameApiClient('test-api-key');
        $result = $client->lock($this->validDeviceId);

        $this->assertEquals($this->validTaskId, $result['task_id']);
    }

    /**
     * @test
     */
    public function get_action_result_returns_task_status(): void
    {
        Http::fake([
            'api.candyhouse.co/public/action-result*' => Http::response([
                'status' => 'terminated',
                'successful' => true,
            ], 200),
        ]);

        $client = new SesameApiClient('test-api-key');
        $result = $client->getActionResult($this->validTaskId);

        $this->assertEquals('terminated', $result['status']);
        $this->assertTrue($result['successful']);
    }

    /**
     * @test
     * Requirements: 9.4 - リトライ処理
     */
    public function retries_on_connection_failure(): void
    {
        $callCount = 0;

        Http::fake(function () use (&$callCount) {
            $callCount++;
            if ($callCount < 3) {
                throw new \Illuminate\Http\Client\ConnectionException('Connection refused');
            }
            return Http::response([
                ['device_id' => $this->validDeviceId],
            ], 200);
        });

        $client = new SesameApiClient('test-api-key', 10, 3);
        $result = $client->getSesameList();

        $this->assertEquals(3, $callCount);
        $this->assertCount(1, $result);
    }

    /**
     * @test
     * Requirements: 9.4 - 認証エラーはリトライしない
     */
    public function does_not_retry_on_unauthorized(): void
    {
        $callCount = 0;

        Http::fake(function () use (&$callCount) {
            $callCount++;
            return Http::response(['error' => 'Unauthorized'], 401);
        });

        $client = new SesameApiClient('invalid-api-key', 10, 3);

        try {
            $client->getSesameList();
            $this->fail('Expected SesameApiException');
        } catch (SesameApiException $e) {
            $this->assertEquals(SesameApiException::CODE_UNAUTHORIZED, $e->getErrorCode());
            $this->assertEquals(1, $callCount); // リトライなし
        }
    }

    /**
     * @test
     * Requirements: 9.4 - デバイス未検出はリトライしない
     */
    public function does_not_retry_on_device_not_found(): void
    {
        $callCount = 0;

        Http::fake(function () use (&$callCount) {
            $callCount++;
            return Http::response(['error' => 'Device not found'], 404);
        });

        $client = new SesameApiClient('test-api-key', 10, 3);

        try {
            $client->getStatus($this->validDeviceId);
            $this->fail('Expected SesameApiException');
        } catch (SesameApiException $e) {
            $this->assertEquals(SesameApiException::CODE_DEVICE_NOT_FOUND, $e->getErrorCode());
            $this->assertEquals(1, $callCount); // リトライなし
        }
    }

    /**
     * @test
     * Requirements: 9.4 - レート制限はリトライしない
     */
    public function does_not_retry_on_rate_limited(): void
    {
        $callCount = 0;

        Http::fake(function () use (&$callCount) {
            $callCount++;
            return Http::response(['error' => 'Rate limited'], 429);
        });

        $client = new SesameApiClient('test-api-key', 10, 3);

        try {
            $client->getSesameList();
            $this->fail('Expected SesameApiException');
        } catch (SesameApiException $e) {
            $this->assertEquals(SesameApiException::CODE_RATE_LIMITED, $e->getErrorCode());
            $this->assertEquals(1, $callCount); // リトライなし
        }
    }

    /**
     * @test
     */
    public function throws_timeout_exception_on_504(): void
    {
        Http::fake([
            'api.candyhouse.co/public/sesames' => Http::response(['error' => 'Gateway Timeout'], 504),
        ]);

        $client = new SesameApiClient('test-api-key', 10, 0); // リトライなし

        $this->expectException(SesameApiException::class);
        $client->getSesameList();
    }

    /**
     * @test
     */
    public function wait_for_task_completion_polls_until_terminated(): void
    {
        $callCount = 0;

        Http::fake(function () use (&$callCount) {
            $callCount++;
            if ($callCount < 3) {
                return Http::response([
                    'status' => 'processing',
                ], 200);
            }
            return Http::response([
                'status' => 'terminated',
                'successful' => true,
            ], 200);
        });

        $client = new SesameApiClient('test-api-key');
        $result = $client->waitForTaskCompletion($this->validTaskId, 10, 10);

        $this->assertEquals('terminated', $result['status']);
        $this->assertTrue($result['successful']);
        $this->assertEquals(3, $callCount);
    }

    /**
     * @test
     */
    public function wait_for_task_completion_throws_on_timeout(): void
    {
        Http::fake([
            'api.candyhouse.co/public/action-result*' => Http::response([
                'status' => 'processing',
            ], 200),
        ]);

        $client = new SesameApiClient('test-api-key');

        $this->expectException(SesameApiException::class);
        $client->waitForTaskCompletion($this->validTaskId, 1, 100);
    }
}
