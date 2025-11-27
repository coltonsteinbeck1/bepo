-- Enable RLS on all tables
ALTER TABLE "public"."bz_roles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."channels" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."guilds" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."messages" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."server_memory" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."user_memory" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."guild_roles" ENABLE ROW LEVEL SECURITY;

-- Service role bypass policies (allows bot full access)
CREATE POLICY "service_role_all_bz_roles" ON "public"."bz_roles" 
    FOR ALL USING ("auth"."role"() = 'service_role');

CREATE POLICY "service_role_all_channels" ON "public"."channels" 
    FOR ALL USING ("auth"."role"() = 'service_role');

CREATE POLICY "service_role_all_guilds" ON "public"."guilds" 
    FOR ALL USING ("auth"."role"() = 'service_role');

CREATE POLICY "service_role_all_messages" ON "public"."messages" 
    FOR ALL USING ("auth"."role"() = 'service_role');

CREATE POLICY "service_role_all_server_memory" ON "public"."server_memory" 
    FOR ALL USING ("auth"."role"() = 'service_role');

CREATE POLICY "service_role_all_guild_roles" ON "public"."guild_roles" 
    FOR ALL USING ("auth"."role"() = 'service_role');

-- Authenticated users can read their own data
CREATE POLICY "users_read_own_memory" ON "public"."user_memory" 
    FOR SELECT USING ("auth"."uid"()::text = "user_id" OR "auth"."role"() = 'service_role');

CREATE POLICY "users_insert_own_memory" ON "public"."user_memory" 
    FOR INSERT WITH CHECK ("auth"."uid"()::text = "user_id" OR "auth"."role"() = 'service_role');

CREATE POLICY "users_update_own_memory" ON "public"."user_memory" 
    FOR UPDATE USING ("auth"."uid"()::text = "user_id" OR "auth"."role"() = 'service_role');

CREATE POLICY "users_delete_own_memory" ON "public"."user_memory" 
    FOR DELETE USING ("auth"."uid"()::text = "user_id" OR "auth"."role"() = 'service_role');

-- Server memory policies (guild-based access)
CREATE POLICY "users_read_server_memory" ON "public"."server_memory" 
    FOR SELECT USING ("auth"."role"() = 'service_role' OR "auth"."uid"()::text = "user_id");

CREATE POLICY "users_insert_server_memory" ON "public"."server_memory" 
    FOR INSERT WITH CHECK ("auth"."role"() = 'service_role');

CREATE POLICY "users_update_server_memory" ON "public"."server_memory" 
    FOR UPDATE USING ("auth"."role"() = 'service_role');

CREATE POLICY "users_delete_server_memory" ON "public"."server_memory" 
    FOR DELETE USING ("auth"."role"() = 'service_role');

-- Messages policies (read-only for authenticated users)
CREATE POLICY "users_read_messages" ON "public"."messages" 
    FOR SELECT USING ("auth"."role"() = 'authenticated' OR "auth"."role"() = 'service_role');

-- Guilds policies (read-only for authenticated users)
CREATE POLICY "users_read_guilds" ON "public"."guilds" 
    FOR SELECT USING ("auth"."role"() = 'authenticated' OR "auth"."role"() = 'service_role');

-- Channels policies (read-only for authenticated users)
CREATE POLICY "users_read_channels" ON "public"."channels" 
    FOR SELECT USING ("auth"."role"() = 'authenticated' OR "auth"."role"() = 'service_role');

-- Guild roles policies (read-only for authenticated users)
CREATE POLICY "users_read_guild_roles" ON "public"."guild_roles" 
    FOR SELECT USING ("auth"."role"() = 'authenticated' OR "auth"."role"() = 'service_role');

-- BZ roles policies (read-only for authenticated users)
CREATE POLICY "users_read_bz_roles" ON "public"."bz_roles" 
    FOR SELECT USING ("auth"."role"() = 'authenticated' OR "auth"."role"() = 'service_role');
