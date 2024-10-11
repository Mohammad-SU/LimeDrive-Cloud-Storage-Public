--
-- PostgreSQL database dump
--

-- Dumped from database version 16.4
-- Dumped by pg_dump version 16.3

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

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: bucket_storage; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bucket_storage (
    singleton_id bigint NOT NULL,
    used bigint DEFAULT 0 NOT NULL,
    cap bigint DEFAULT 0 NOT NULL,
    CONSTRAINT chk_bucket_cap_reached CHECK ((used <= cap)),
    CONSTRAINT chk_non_negative_bucket_cap CHECK ((cap >= 0)),
    CONSTRAINT chk_non_negative_bucket_used CHECK ((used >= 0))
);


--
-- Name: COLUMN bucket_storage.used; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.bucket_storage.used IS 'Does NOT include manually uploaded files to the bucket such as the sample files folder (which are negligible, plus the value for the column could be hard to correct in case the sample files change).';


--
-- Name: COLUMN bucket_storage.cap; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.bucket_storage.cap IS 'For conversions, use "gigabyte/megabyte.", NOT gibibyte/mebibyte (r2 uses decimal units).';


--
-- Name: files; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.files (
    id bigint NOT NULL,
    user_id bigint NOT NULL,
    name character varying(255) NOT NULL,
    app_path character varying(500) NOT NULL,
    type character varying(255) NOT NULL,
    size bigint NOT NULL,
    created_at timestamp with time zone NOT NULL,
    parent_folder_id bigint,
    enc_share_key character varying(255),
    media_duration double precision,
    is_sample boolean DEFAULT false NOT NULL,
    is_uploaded boolean DEFAULT false NOT NULL,
    CONSTRAINT chk_non_negative_duration CHECK ((media_duration >= (0)::double precision)),
    CONSTRAINT chk_non_negative_size CHECK ((size >= 0))
);


--
-- Name: COLUMN files.enc_share_key; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.files.enc_share_key IS 'Do not add uq constraint. ID is also used in url to get the right file.';


--
-- Name: files_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.files_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: files_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.files_id_seq OWNED BY public.files.id;


--
-- Name: folders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.folders (
    id bigint NOT NULL,
    user_id bigint NOT NULL,
    name character varying(255) NOT NULL,
    app_path character varying(500) NOT NULL,
    created_at timestamp with time zone NOT NULL,
    parent_folder_id bigint,
    is_sample boolean DEFAULT false NOT NULL,
    CONSTRAINT chk_self_reference CHECK ((id <> parent_folder_id))
);


--
-- Name: folders_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.folders_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: folders_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.folders_id_seq OWNED BY public.folders.id;


--
-- Name: jobs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.jobs (
    id bigint NOT NULL,
    queue character varying(255) NOT NULL,
    payload text NOT NULL,
    attempts smallint NOT NULL,
    reserved_at integer,
    available_at integer NOT NULL,
    created_at integer NOT NULL
);


--
-- Name: jobs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.jobs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: jobs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.jobs_id_seq OWNED BY public.jobs.id;


--
-- Name: migrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.migrations (
    id integer NOT NULL,
    migration character varying(255) NOT NULL,
    batch integer NOT NULL
);


--
-- Name: migrations_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.migrations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: migrations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.migrations_id_seq OWNED BY public.migrations.id;


--
-- Name: sample_files; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sample_files (
    id bigint NOT NULL,
    name character varying(255) NOT NULL,
    app_path character varying(1000) NOT NULL,
    type character varying(255) NOT NULL,
    size bigint NOT NULL,
    sample_parent_folder_id bigint,
    media_duration double precision,
    CONSTRAINT chk_non_negative_duration CHECK ((media_duration >= (0)::double precision)),
    CONSTRAINT chk_non_negative_size CHECK ((size >= 0))
);


--
-- Name: sample_files_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.sample_files_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: sample_files_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.sample_files_id_seq OWNED BY public.sample_files.id;


--
-- Name: sample_folders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sample_folders (
    id bigint NOT NULL,
    name character varying(255) NOT NULL,
    app_path character varying(1000) NOT NULL,
    sample_parent_folder_id bigint
);


--
-- Name: sample_folders_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.sample_folders_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: sample_folders_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.sample_folders_id_seq OWNED BY public.sample_folders.id;


--
-- Name: sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sessions (
    id character varying(255) NOT NULL,
    user_id bigint,
    ip_address character varying(45),
    user_agent text,
    payload text NOT NULL,
    last_activity integer NOT NULL
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id bigint NOT NULL,
    username character varying(30) NOT NULL,
    email character varying(255),
    password character varying(255) NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    account_storage_used bigint DEFAULT 0 NOT NULL,
    account_storage_cap bigint DEFAULT 209715200 NOT NULL,
    user_bucket_storage_used bigint DEFAULT 0 NOT NULL,
    is_email_verified boolean DEFAULT false NOT NULL,
    enc_verify_email_key character varying(255),
    has_consented boolean DEFAULT false NOT NULL,
    CONSTRAINT chk_acc_storage_cap_not_reached CHECK ((account_storage_used <= account_storage_cap)),
    CONSTRAINT chk_non_negative_acc_storage_cap CHECK ((account_storage_cap >= 0)),
    CONSTRAINT chk_non_negative_acc_storage_used CHECK ((account_storage_used >= 0)),
    CONSTRAINT chk_non_negative_user_bucket_storage_used CHECK ((user_bucket_storage_used >= 0)),
    CONSTRAINT chk_user_bucket_storage_used CHECK ((user_bucket_storage_used <= account_storage_cap))
);


--
-- Name: COLUMN users.account_storage_used; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.users.account_storage_used IS 'Storage used by the user including duplicate bucket object references.';


--
-- Name: COLUMN users.account_storage_cap; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.users.account_storage_cap IS 'Binary unit. This is storage limit for the user including duplicate bucket object references.';


--
-- Name: COLUMN users.user_bucket_storage_used; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.users.user_bucket_storage_used IS 'Bucket storage used by the user (so NOT including any duplicate bucket object references as these do not apply here).';


--
-- Name: COLUMN users.enc_verify_email_key; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.users.enc_verify_email_key IS 'Do not add uq constraint. SHA-256 is very low collision chance and user ID is used in URL.';


--
-- Name: CONSTRAINT chk_user_bucket_storage_used ON users; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON CONSTRAINT chk_user_bucket_storage_used ON public.users IS 'The check has account_storage_limit instead of account_storage_used as the backend delete controller updates account_storage_used first which would otherwise not pass this check.';


--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.users_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: files id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.files ALTER COLUMN id SET DEFAULT nextval('public.files_id_seq'::regclass);


--
-- Name: folders id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.folders ALTER COLUMN id SET DEFAULT nextval('public.folders_id_seq'::regclass);


--
-- Name: jobs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.jobs ALTER COLUMN id SET DEFAULT nextval('public.jobs_id_seq'::regclass);


--
-- Name: migrations id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.migrations ALTER COLUMN id SET DEFAULT nextval('public.migrations_id_seq'::regclass);


--
-- Name: sample_files id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sample_files ALTER COLUMN id SET DEFAULT nextval('public.sample_files_id_seq'::regclass);


--
-- Name: sample_folders id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sample_folders ALTER COLUMN id SET DEFAULT nextval('public.sample_folders_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Name: bucket_storage ensure_singleton; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bucket_storage
    ADD CONSTRAINT ensure_singleton PRIMARY KEY (singleton_id);


--
-- Name: files files_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.files
    ADD CONSTRAINT files_pkey PRIMARY KEY (id);


--
-- Name: folders folders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.folders
    ADD CONSTRAINT folders_pkey PRIMARY KEY (id);


--
-- Name: jobs jobs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.jobs
    ADD CONSTRAINT jobs_pkey PRIMARY KEY (id);


--
-- Name: migrations migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.migrations
    ADD CONSTRAINT migrations_pkey PRIMARY KEY (id);


--
-- Name: sample_files sample_files_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sample_files
    ADD CONSTRAINT sample_files_pkey PRIMARY KEY (id);


--
-- Name: sample_folders sample_folders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sample_folders
    ADD CONSTRAINT sample_folders_pkey PRIMARY KEY (id);


--
-- Name: sessions sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_pkey PRIMARY KEY (id);


--
-- Name: folders uq_user_parentfolder_or_root_folders; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.folders
    ADD CONSTRAINT uq_user_parentfolder_or_root_folders UNIQUE NULLS NOT DISTINCT (user_id, parent_folder_id, name);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: users users_username_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key UNIQUE (username);


--
-- Name: jobs_queue_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX jobs_queue_index ON public.jobs USING btree (queue);


--
-- Name: sessions_last_activity_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sessions_last_activity_index ON public.sessions USING btree (last_activity);


--
-- Name: sessions_user_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sessions_user_id_index ON public.sessions USING btree (user_id);


--
-- Name: uq_user_parentfolder_or_root_files; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_user_parentfolder_or_root_files ON public.files USING btree (user_id, parent_folder_id, name) NULLS NOT DISTINCT WHERE (is_uploaded = true);


--
-- Name: files fk_parentfolderid_files; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.files
    ADD CONSTRAINT fk_parentfolderid_files FOREIGN KEY (parent_folder_id) REFERENCES public.folders(id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: folders fk_parentfolderid_folders; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.folders
    ADD CONSTRAINT fk_parentfolderid_folders FOREIGN KEY (parent_folder_id) REFERENCES public.folders(id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: sample_files fk_sampleparentfolderid_samplefiles; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sample_files
    ADD CONSTRAINT fk_sampleparentfolderid_samplefiles FOREIGN KEY (sample_parent_folder_id) REFERENCES public.sample_folders(id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: sample_folders fk_sampleparentfolderid_samplefolders; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sample_folders
    ADD CONSTRAINT fk_sampleparentfolderid_samplefolders FOREIGN KEY (sample_parent_folder_id) REFERENCES public.sample_folders(id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: files fk_userid_files; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.files
    ADD CONSTRAINT fk_userid_files FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: folders fk_userid_folders; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.folders
    ADD CONSTRAINT fk_userid_folders FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- PostgreSQL database dump complete
--

--
-- PostgreSQL database dump
--

-- Dumped from database version 16.4
-- Dumped by pg_dump version 16.3

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
-- Data for Name: migrations; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.migrations (id, migration, batch) FROM stdin;
1	2019_12_14_000001_create_personal_access_tokens_table	1
2	2024_03_12_092013_create_jobs_table	1
3	2024_05_16_012719_create_jobs_table	2
4	2024_07_16_171902_create_bucket_storage_table	0
5	2024_07_16_171902_create_files_table	0
6	2024_07_16_171902_create_folders_table	0
7	2024_07_16_171902_create_jobs_table	0
8	2024_07_16_171902_create_personal_access_tokens_table	0
9	2024_07_16_171902_create_sample_files_table	0
10	2024_07_16_171902_create_sample_folders_table	0
11	2024_07_16_171902_create_users_table	0
12	2024_07_16_171905_add_foreign_keys_to_files_table	0
13	2024_07_16_171905_add_foreign_keys_to_folders_table	0
14	2024_07_16_171905_add_foreign_keys_to_sample_files_table	0
15	2024_07_16_171905_add_foreign_keys_to_sample_folders_table	0
16	2024_07_17_005040_modify_is_sample_in_folders_table	3
17	2024_07_17_005339_modify_is_sample_in_files_table	4
23	2024_08_17_150114_alter_files_table_upload_urls	5
24	2024_08_19_015111_files_non_negative_chk_duration_and_size	6
25	2024_08_19_020149_sample_files_non_negative_chk_duration_and_size	7
26	2024_08_19_020414_rename_users_chk_acc_storage_cap_reached	8
28	2024_08_22_182411_drop_files_md5	9
29	2024_08_25_235157_alter_files_table_add_nulls_not_distinct	10
30	2024_08_28_025053_alter_files_and_folders_table_rename_date_to_created_at	11
31	2024_09_07_144951_updated_users_password_hash_rename	12
32	2024_09_08_141444_create_sessions_table	13
33	2024_09_08_141608_drop_personal_access_tokens_table	14
34	2024_10_03_213814_add_has_consented_to_users_table	15
\.


--
-- Name: migrations_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.migrations_id_seq', 34, true);


--
-- PostgreSQL database dump complete
--

