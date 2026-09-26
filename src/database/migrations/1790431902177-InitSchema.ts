import { MigrationInterface, QueryRunner } from "typeorm";

export class InitSchema1790431902177 implements MigrationInterface {
    name = 'InitSchema1790431902177'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "roles" ("id" SERIAL NOT NULL, "name" character varying(50) NOT NULL, "description" character varying(255), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_648e3f5447f725579d7d4ffdfb7" UNIQUE ("name"), CONSTRAINT "PK_c1433d71a4838793a49dcad46ab" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "sessions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "user_id" uuid NOT NULL, "refresh_token_hash" character varying(255) NOT NULL, "user_agent" character varying(500), "ip_address" character varying(45), "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL, "revoked_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_3238ef96f18b355b671619111bc" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_085d540d9f418cfbdc7bd55bb1" ON "sessions" ("user_id") `);
        await queryRunner.query(`CREATE TABLE "plans" ("id" SERIAL NOT NULL, "code" character varying(50) NOT NULL, "name" character varying(100) NOT NULL, "description" text, "price_cents" integer NOT NULL DEFAULT '0', "currency" character varying(3) NOT NULL DEFAULT 'USD', "daily_chat_limit" integer, "daily_search_limit" integer, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_95f7ef3fc4c31a3545b4d825dd4" UNIQUE ("code"), CONSTRAINT "PK_3720521a81c7c24fe9b7202ba61" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."subscription_status_enum" AS ENUM('ACTIVE', 'CANCELLED', 'EXPIRED')`);
        await queryRunner.query(`CREATE TABLE "subscriptions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "user_id" uuid NOT NULL, "plan_id" integer NOT NULL, "status" "public"."subscription_status_enum" NOT NULL DEFAULT 'ACTIVE', "started_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "ends_at" TIMESTAMP WITH TIME ZONE, "cancelled_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_a87248d73155605cf782be9ee5e" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_e45fca5d912c3a2fab512ac25d" ON "subscriptions" ("plan_id") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "uq_subscriptions_one_active_per_user" ON "subscriptions" ("user_id") WHERE "status" = 'ACTIVE'`);
        await queryRunner.query(`CREATE INDEX "IDX_1a15756e257e0eaf01edc85645" ON "subscriptions" ("user_id", "status") `);
        await queryRunner.query(`CREATE TABLE "ai_models" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "provider_id" uuid NOT NULL, "model_key" character varying(100) NOT NULL, "display_name" character varying(100) NOT NULL, "is_enabled" boolean NOT NULL DEFAULT true, "is_default" boolean NOT NULL DEFAULT false, "premium_only" boolean NOT NULL DEFAULT false, "max_tokens" integer, CONSTRAINT "chk_ai_models_default_is_enabled" CHECK (NOT ("is_default" = true AND "is_enabled" = false)), CONSTRAINT "PK_3d254744f0bcf6f35be5826e25e" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "uq_ai_models_one_default_per_provider" ON "ai_models" ("provider_id") WHERE "is_default" = true`);
        await queryRunner.query(`CREATE UNIQUE INDEX "uq_ai_models_provider_model_key" ON "ai_models" ("provider_id", "model_key") `);
        await queryRunner.query(`CREATE TYPE "public"."provider_type_enum" AS ENUM('OPENAI', 'ANTHROPIC', 'GEMINI')`);
        await queryRunner.query(`CREATE TYPE "public"."provider_health_enum" AS ENUM('UNKNOWN', 'HEALTHY', 'DEGRADED', 'DOWN')`);
        await queryRunner.query(`CREATE TABLE "ai_providers" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "name" character varying(100) NOT NULL, "type" "public"."provider_type_enum" NOT NULL, "base_url" character varying(500), "api_key_encrypted" text NOT NULL, "api_key_last4" character varying(4), "is_enabled" boolean NOT NULL DEFAULT true, "is_default" boolean NOT NULL DEFAULT false, "health_status" "public"."provider_health_enum" NOT NULL DEFAULT 'UNKNOWN', "last_health_check_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "UQ_977b5cdcd754ad0457cf80a3fe0" UNIQUE ("name"), CONSTRAINT "chk_ai_providers_default_is_enabled" CHECK (NOT ("is_default" = true AND "is_enabled" = false)), CONSTRAINT "PK_de28ebefc0fb425c37b27a4c0a7" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "uq_ai_providers_single_default" ON "ai_providers" ("is_default") WHERE "is_default" = true`);
        await queryRunner.query(`CREATE TYPE "public"."message_role_enum" AS ENUM('SYSTEM', 'USER', 'ASSISTANT')`);
        await queryRunner.query(`CREATE TABLE "messages" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "conversation_id" uuid NOT NULL, "role" "public"."message_role_enum" NOT NULL, "content" text NOT NULL, "provider_id" uuid, "model_key" character varying(100), "prompt_tokens" integer, "completion_tokens" integer, "latency_ms" integer, CONSTRAINT "PK_18325f38ae6de43878487eff986" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_8584a1974e1ca95f4861d975ff" ON "messages" ("conversation_id", "created_at") `);
        await queryRunner.query(`CREATE TABLE "conversations" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "user_id" uuid NOT NULL, "title" character varying(255) NOT NULL DEFAULT 'New chat', "provider_id" uuid, "model_id" uuid, CONSTRAINT "PK_ee34f4f7ced4ec8681f26bf04ef" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_b05dce850aa5c6710e5d05533a" ON "conversations" ("user_id", "updated_at") `);
        await queryRunner.query(`CREATE TABLE "web_searches" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "user_id" uuid NOT NULL, "query" character varying(500) NOT NULL, "results" jsonb, "ai_summary" text, "result_count" integer NOT NULL DEFAULT '0', "provider_id" uuid, "from_cache" boolean NOT NULL DEFAULT false, CONSTRAINT "PK_dbec663af69a28037f60b34ab63" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_bb93e9e5705a7d18219b45441b" ON "web_searches" ("user_id", "created_at") `);
        await queryRunner.query(`CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "email" character varying(255) NOT NULL, "password_hash" character varying(255) NOT NULL, "full_name" character varying(100), "avatar_url" character varying(500), "is_email_verified" boolean NOT NULL DEFAULT false, "is_active" boolean NOT NULL DEFAULT true, "last_login_at" TIMESTAMP WITH TIME ZONE, "role_id" integer NOT NULL, CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email"), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_a2cecd1a3531c0b041e29ba46e" ON "users" ("role_id") `);
        await queryRunner.query(`CREATE TYPE "public"."usage_type_enum" AS ENUM('CHAT', 'SEARCH')`);
        await queryRunner.query(`CREATE TABLE "daily_usage" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "user_id" uuid NOT NULL, "date" date NOT NULL, "type" "public"."usage_type_enum" NOT NULL, "count" integer NOT NULL DEFAULT '0', CONSTRAINT "PK_1bd9fdfb7b3346372acc82e8b93" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "uq_daily_usage_user_date_type" ON "daily_usage" ("user_id", "date", "type") `);
        await queryRunner.query(`CREATE TYPE "public"."api_usage_log_type_enum" AS ENUM('CHAT', 'SEARCH')`);
        await queryRunner.query(`CREATE TABLE "api_usage_logs" ("id" BIGSERIAL NOT NULL, "user_id" uuid, "method" character varying(10) NOT NULL, "path" character varying(500) NOT NULL, "status_code" integer NOT NULL, "duration_ms" integer NOT NULL, "ip_address" character varying(45), "user_agent" character varying(500), "usage_type" "public"."api_usage_log_type_enum", "provider_id" uuid, "prompt_tokens" integer, "completion_tokens" integer, "error_message" text, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_44911ac00797b4afb1be1cac1a9" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_7a468e1f171c8cb0d839e54d09" ON "api_usage_logs" ("created_at") `);
        await queryRunner.query(`CREATE INDEX "IDX_3491dac189d335d09513d7e01b" ON "api_usage_logs" ("provider_id", "created_at") `);
        await queryRunner.query(`CREATE INDEX "IDX_d737efeb438aa89bf5fd0a7086" ON "api_usage_logs" ("user_id", "created_at") `);
        await queryRunner.query(`CREATE TABLE "search_cache" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "query_hash" character varying(64) NOT NULL, "query" character varying(500) NOT NULL, "results" jsonb NOT NULL, "ai_summary" text, "hit_count" integer NOT NULL DEFAULT '0', "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "UQ_d9d9471c3a65f2fbb041ad1d6c3" UNIQUE ("query_hash"), CONSTRAINT "PK_b886d009e33564b3b38f32f9328" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_a0ad5a83c042370c8d97534a16" ON "search_cache" ("expires_at") `);
        await queryRunner.query(`CREATE TABLE "email_verification_tokens" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "user_id" uuid NOT NULL, "token_hash" character varying(255) NOT NULL, "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL, "used_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "UQ_c20ed35f3d31d486aabcd0564da" UNIQUE ("token_hash"), CONSTRAINT "PK_417a095bbed21c2369a6a01ab9a" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_fdcb77f72f529bf65c95d72a14" ON "email_verification_tokens" ("user_id") `);
        await queryRunner.query(`ALTER TABLE "sessions" ADD CONSTRAINT "FK_085d540d9f418cfbdc7bd55bb19" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "subscriptions" ADD CONSTRAINT "FK_d0a95ef8a28188364c546eb65c1" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "subscriptions" ADD CONSTRAINT "FK_e45fca5d912c3a2fab512ac25dc" FOREIGN KEY ("plan_id") REFERENCES "plans"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "ai_models" ADD CONSTRAINT "FK_959da1d5b224333f044c958feb5" FOREIGN KEY ("provider_id") REFERENCES "ai_providers"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "messages" ADD CONSTRAINT "FK_3bc55a7c3f9ed54b520bb5cfe23" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "messages" ADD CONSTRAINT "FK_e7da7711dc1e61f24251ca11ff2" FOREIGN KEY ("provider_id") REFERENCES "ai_providers"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "conversations" ADD CONSTRAINT "FK_3a9ae579e61e81cc0e989afeb4a" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "conversations" ADD CONSTRAINT "FK_93f3c4e075389d1faccec56ab68" FOREIGN KEY ("provider_id") REFERENCES "ai_providers"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "conversations" ADD CONSTRAINT "FK_748d61ec2ccc1e46b979d9f8c33" FOREIGN KEY ("model_id") REFERENCES "ai_models"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "web_searches" ADD CONSTRAINT "FK_2fb3dc7479b8ded13e49990d0c7" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "web_searches" ADD CONSTRAINT "FK_1d7b970eb875819d47e2ac2da8e" FOREIGN KEY ("provider_id") REFERENCES "ai_providers"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "users" ADD CONSTRAINT "FK_a2cecd1a3531c0b041e29ba46e1" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "daily_usage" ADD CONSTRAINT "FK_a082e398adfbfc6778659718f32" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "api_usage_logs" ADD CONSTRAINT "FK_e60c9fbae8b88e6bf43942ac61e" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "api_usage_logs" ADD CONSTRAINT "FK_65b0e36a88ca57923099d2493ee" FOREIGN KEY ("provider_id") REFERENCES "ai_providers"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "email_verification_tokens" ADD CONSTRAINT "FK_fdcb77f72f529bf65c95d72a147" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "email_verification_tokens" DROP CONSTRAINT "FK_fdcb77f72f529bf65c95d72a147"`);
        await queryRunner.query(`ALTER TABLE "api_usage_logs" DROP CONSTRAINT "FK_65b0e36a88ca57923099d2493ee"`);
        await queryRunner.query(`ALTER TABLE "api_usage_logs" DROP CONSTRAINT "FK_e60c9fbae8b88e6bf43942ac61e"`);
        await queryRunner.query(`ALTER TABLE "daily_usage" DROP CONSTRAINT "FK_a082e398adfbfc6778659718f32"`);
        await queryRunner.query(`ALTER TABLE "users" DROP CONSTRAINT "FK_a2cecd1a3531c0b041e29ba46e1"`);
        await queryRunner.query(`ALTER TABLE "web_searches" DROP CONSTRAINT "FK_1d7b970eb875819d47e2ac2da8e"`);
        await queryRunner.query(`ALTER TABLE "web_searches" DROP CONSTRAINT "FK_2fb3dc7479b8ded13e49990d0c7"`);
        await queryRunner.query(`ALTER TABLE "conversations" DROP CONSTRAINT "FK_748d61ec2ccc1e46b979d9f8c33"`);
        await queryRunner.query(`ALTER TABLE "conversations" DROP CONSTRAINT "FK_93f3c4e075389d1faccec56ab68"`);
        await queryRunner.query(`ALTER TABLE "conversations" DROP CONSTRAINT "FK_3a9ae579e61e81cc0e989afeb4a"`);
        await queryRunner.query(`ALTER TABLE "messages" DROP CONSTRAINT "FK_e7da7711dc1e61f24251ca11ff2"`);
        await queryRunner.query(`ALTER TABLE "messages" DROP CONSTRAINT "FK_3bc55a7c3f9ed54b520bb5cfe23"`);
        await queryRunner.query(`ALTER TABLE "ai_models" DROP CONSTRAINT "FK_959da1d5b224333f044c958feb5"`);
        await queryRunner.query(`ALTER TABLE "subscriptions" DROP CONSTRAINT "FK_e45fca5d912c3a2fab512ac25dc"`);
        await queryRunner.query(`ALTER TABLE "subscriptions" DROP CONSTRAINT "FK_d0a95ef8a28188364c546eb65c1"`);
        await queryRunner.query(`ALTER TABLE "sessions" DROP CONSTRAINT "FK_085d540d9f418cfbdc7bd55bb19"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_fdcb77f72f529bf65c95d72a14"`);
        await queryRunner.query(`DROP TABLE "email_verification_tokens"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_a0ad5a83c042370c8d97534a16"`);
        await queryRunner.query(`DROP TABLE "search_cache"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_d737efeb438aa89bf5fd0a7086"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_3491dac189d335d09513d7e01b"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_7a468e1f171c8cb0d839e54d09"`);
        await queryRunner.query(`DROP TABLE "api_usage_logs"`);
        await queryRunner.query(`DROP TYPE "public"."api_usage_log_type_enum"`);
        await queryRunner.query(`DROP INDEX "public"."uq_daily_usage_user_date_type"`);
        await queryRunner.query(`DROP TABLE "daily_usage"`);
        await queryRunner.query(`DROP TYPE "public"."usage_type_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_a2cecd1a3531c0b041e29ba46e"`);
        await queryRunner.query(`DROP TABLE "users"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_bb93e9e5705a7d18219b45441b"`);
        await queryRunner.query(`DROP TABLE "web_searches"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_b05dce850aa5c6710e5d05533a"`);
        await queryRunner.query(`DROP TABLE "conversations"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_8584a1974e1ca95f4861d975ff"`);
        await queryRunner.query(`DROP TABLE "messages"`);
        await queryRunner.query(`DROP TYPE "public"."message_role_enum"`);
        await queryRunner.query(`DROP INDEX "public"."uq_ai_providers_single_default"`);
        await queryRunner.query(`DROP TABLE "ai_providers"`);
        await queryRunner.query(`DROP TYPE "public"."provider_health_enum"`);
        await queryRunner.query(`DROP TYPE "public"."provider_type_enum"`);
        await queryRunner.query(`DROP INDEX "public"."uq_ai_models_provider_model_key"`);
        await queryRunner.query(`DROP INDEX "public"."uq_ai_models_one_default_per_provider"`);
        await queryRunner.query(`DROP TABLE "ai_models"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_1a15756e257e0eaf01edc85645"`);
        await queryRunner.query(`DROP INDEX "public"."uq_subscriptions_one_active_per_user"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_e45fca5d912c3a2fab512ac25d"`);
        await queryRunner.query(`DROP TABLE "subscriptions"`);
        await queryRunner.query(`DROP TYPE "public"."subscription_status_enum"`);
        await queryRunner.query(`DROP TABLE "plans"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_085d540d9f418cfbdc7bd55bb1"`);
        await queryRunner.query(`DROP TABLE "sessions"`);
        await queryRunner.query(`DROP TABLE "roles"`);
    }

}
