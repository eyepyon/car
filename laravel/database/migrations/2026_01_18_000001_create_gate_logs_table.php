<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Gate Logs Table Migration
 *
 * ゲート操作ログを保存するテーブル
 *
 * Requirements: 9.5
 */
return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('gate_logs', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('device_id')->index();
            $table->string('operation', 20); // unlock, lock, sync
            $table->boolean('success')->default(false);
            $table->string('license_plate', 20)->nullable()->index();
            $table->decimal('recognition_confidence', 5, 2)->nullable();
            $table->uuid('task_id')->nullable();
            $table->text('error_message')->nullable();
            $table->timestamps();

            // インデックス
            $table->index(['device_id', 'created_at']);
            $table->index(['license_plate', 'created_at']);
            $table->index(['success', 'created_at']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('gate_logs');
    }
};
