--
-- PostgreSQL database dump
--

-- Dumped from database version 15.13
-- Dumped by pg_dump version 15.13 (Debian 15.13-1.pgdg120+1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

-- *not* creating schema, since initdb creates it


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS '';


--
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;


--
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';


--
-- Name: set_current_timestamp_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_current_timestamp_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  _new record;
BEGIN
  _new := NEW;
  _new."updated_at" = NOW();
  RETURN _new;
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: announcements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.announcements (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    text text NOT NULL,
    community_id uuid NOT NULL,
    target_query text,
    author_id uuid NOT NULL
);


--
-- Name: TABLE announcements; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.announcements IS 'announcements sent via rhizal';


--
-- Name: communities; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.communities (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    onboarding_id uuid,
    bot_phone text,
    name text,
    description text,
    group_script_id uuid
);


--
-- Name: TABLE communities; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.communities IS 'Network of relationships utilizing Rhizal';


--
-- Name: events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    name text NOT NULL,
    description text NOT NULL,
    start_time timestamp with time zone NOT NULL,
    end_time timestamp with time zone NOT NULL,
    location text NOT NULL,
    community_id uuid NOT NULL
);


--
-- Name: TABLE events; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.events IS 'Events that rhizal can invite users to';


--
-- Name: group_threads; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.group_threads (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    group_id text NOT NULL,
    hashtag text,
    community_id uuid NOT NULL,
    step text,
    permissions text[]
);


--
-- Name: TABLE group_threads; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.group_threads IS 'Small group discussions on Signal';


--
-- Name: memberships; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.memberships (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    user_id uuid NOT NULL,
    community_id uuid NOT NULL,
    permissions text[] NOT NULL,
    profile text,
    intro_id uuid,
    email text,
    name text,
    informal_name text,
    location text,
    step text,
    current_script_id uuid
);


--
-- Name: TABLE memberships; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.memberships IS 'Roles that a user plays in a community';


--
-- Name: messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    text text,
    membership_id uuid NOT NULL,
    sent_time timestamp with time zone,
    community_id uuid NOT NULL,
    from_user boolean DEFAULT false NOT NULL,
    signal_timestamp bigint,
    about_membership_id uuid,
    type text
);


--
-- Name: TABLE messages; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.messages IS 'Messages sent to and from rhizal';


--
-- Name: registrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.registrations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    membership_id uuid NOT NULL,
    event_id uuid NOT NULL,
    status text,
    is_host boolean DEFAULT false NOT NULL
);


--
-- Name: TABLE registrations; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.registrations IS 'Users hosting events';


--
-- Name: scripts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.scripts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    name text NOT NULL,
    script_json text NOT NULL,
    vars_query text,
    targets_query text,
    community_id uuid NOT NULL,
    created_by uuid
);


--
-- Name: TABLE scripts; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.scripts IS 'Scritps which define how rhizal behaves';


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    phone text NOT NULL
);


--
-- Name: TABLE users; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.users IS 'Individuals with whome rhizal communicates';


--
-- Name: announcements announcements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.announcements
    ADD CONSTRAINT announcements_pkey PRIMARY KEY (id);


--
-- Name: communities communities_bot_phone_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.communities
    ADD CONSTRAINT communities_bot_phone_key UNIQUE (bot_phone);


--
-- Name: communities community_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.communities
    ADD CONSTRAINT community_id_key UNIQUE (id);


--
-- Name: communities community_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.communities
    ADD CONSTRAINT community_pkey PRIMARY KEY (id);


--
-- Name: registrations event_hosts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.registrations
    ADD CONSTRAINT event_hosts_pkey PRIMARY KEY (id);


--
-- Name: events events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.events
    ADD CONSTRAINT events_pkey PRIMARY KEY (id);


--
-- Name: group_threads group_thread_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.group_threads
    ADD CONSTRAINT group_thread_id_key UNIQUE (id);


--
-- Name: group_threads group_thread_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.group_threads
    ADD CONSTRAINT group_thread_pkey PRIMARY KEY (id);


--
-- Name: messages messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_pkey PRIMARY KEY (id);


--
-- Name: memberships role_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.memberships
    ADD CONSTRAINT role_pkey PRIMARY KEY (id);


--
-- Name: scripts script_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scripts
    ADD CONSTRAINT script_id_key UNIQUE (id);


--
-- Name: scripts script_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scripts
    ADD CONSTRAINT script_pkey PRIMARY KEY (id, name);


--
-- Name: users users_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_id_key UNIQUE (id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id, phone);


--
-- Name: communities set_public_community_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_public_community_updated_at BEFORE UPDATE ON public.communities FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();


--
-- Name: TRIGGER set_public_community_updated_at ON communities; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TRIGGER set_public_community_updated_at ON public.communities IS 'trigger to set value of column "updated_at" to current timestamp on row update';


--
-- Name: registrations set_public_event_hosts_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_public_event_hosts_updated_at BEFORE UPDATE ON public.registrations FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();


--
-- Name: TRIGGER set_public_event_hosts_updated_at ON registrations; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TRIGGER set_public_event_hosts_updated_at ON public.registrations IS 'trigger to set value of column "updated_at" to current timestamp on row update';


--
-- Name: events set_public_events_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_public_events_updated_at BEFORE UPDATE ON public.events FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();


--
-- Name: TRIGGER set_public_events_updated_at ON events; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TRIGGER set_public_events_updated_at ON public.events IS 'trigger to set value of column "updated_at" to current timestamp on row update';


--
-- Name: group_threads set_public_group_thread_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_public_group_thread_updated_at BEFORE UPDATE ON public.group_threads FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();


--
-- Name: TRIGGER set_public_group_thread_updated_at ON group_threads; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TRIGGER set_public_group_thread_updated_at ON public.group_threads IS 'trigger to set value of column "updated_at" to current timestamp on row update';


--
-- Name: messages set_public_messages_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_public_messages_updated_at BEFORE UPDATE ON public.messages FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();


--
-- Name: TRIGGER set_public_messages_updated_at ON messages; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TRIGGER set_public_messages_updated_at ON public.messages IS 'trigger to set value of column "updated_at" to current timestamp on row update';


--
-- Name: memberships set_public_role_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_public_role_updated_at BEFORE UPDATE ON public.memberships FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();


--
-- Name: TRIGGER set_public_role_updated_at ON memberships; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TRIGGER set_public_role_updated_at ON public.memberships IS 'trigger to set value of column "updated_at" to current timestamp on row update';


--
-- Name: scripts set_public_script_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_public_script_updated_at BEFORE UPDATE ON public.scripts FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();


--
-- Name: TRIGGER set_public_script_updated_at ON scripts; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TRIGGER set_public_script_updated_at ON public.scripts IS 'trigger to set value of column "updated_at" to current timestamp on row update';


--
-- Name: users set_public_users_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_public_users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();


--
-- Name: TRIGGER set_public_users_updated_at ON users; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TRIGGER set_public_users_updated_at ON public.users IS 'trigger to set value of column "updated_at" to current timestamp on row update';


--
-- Name: announcements announcements_community_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.announcements
    ADD CONSTRAINT announcements_community_fkey FOREIGN KEY (community_id) REFERENCES public.communities(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: announcements announcements_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.announcements
    ADD CONSTRAINT announcements_id_fkey FOREIGN KEY (id) REFERENCES public.memberships(id) ON UPDATE SET NULL ON DELETE SET NULL;


--
-- Name: communities communities_group_script_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.communities
    ADD CONSTRAINT communities_group_script_id_fkey FOREIGN KEY (group_script_id) REFERENCES public.scripts(id) ON UPDATE SET NULL ON DELETE SET NULL;


--
-- Name: communities communities_onboarding_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.communities
    ADD CONSTRAINT communities_onboarding_fkey FOREIGN KEY (onboarding_id) REFERENCES public.scripts(id) ON UPDATE SET NULL ON DELETE SET NULL;


--
-- Name: registrations event_hosts_event_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.registrations
    ADD CONSTRAINT event_hosts_event_fkey FOREIGN KEY (event_id) REFERENCES public.events(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: events events_community_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.events
    ADD CONSTRAINT events_community_fkey FOREIGN KEY (community_id) REFERENCES public.communities(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: group_threads group_thread_community_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.group_threads
    ADD CONSTRAINT group_thread_community_fkey FOREIGN KEY (community_id) REFERENCES public.communities(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: memberships memberships_current_script_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.memberships
    ADD CONSTRAINT memberships_current_script_id_fkey FOREIGN KEY (current_script_id) REFERENCES public.scripts(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: memberships memberships_intro_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.memberships
    ADD CONSTRAINT memberships_intro_id_fkey FOREIGN KEY (intro_id) REFERENCES public.messages(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: messages messages_community_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_community_fkey FOREIGN KEY (community_id) REFERENCES public.communities(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: messages messages_membership_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_membership_id_fkey FOREIGN KEY (membership_id) REFERENCES public.memberships(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: registrations registrations_membership_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.registrations
    ADD CONSTRAINT registrations_membership_id_fkey FOREIGN KEY (membership_id) REFERENCES public.memberships(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: memberships role_community_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.memberships
    ADD CONSTRAINT role_community_fkey FOREIGN KEY (community_id) REFERENCES public.communities(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: memberships role_user_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.memberships
    ADD CONSTRAINT role_user_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: scripts script_community_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scripts
    ADD CONSTRAINT script_community_fkey FOREIGN KEY (community_id) REFERENCES public.communities(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: scripts scripts_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scripts
    ADD CONSTRAINT scripts_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.memberships(id) ON UPDATE SET NULL ON DELETE SET NULL;


--
-- PostgreSQL database dump complete
--

