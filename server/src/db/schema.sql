/* ============================================================
 * PBLOG 数据库结构  MySQL 8.0+ / MariaDB 10.6+
 * 字符集 utf8mb4，适合中文与 emoji
 * ============================================================ */

SET NAMES utf8mb4;

-- ---------- 用户（管理员） ----------
CREATE TABLE IF NOT EXISTS `users` (
  `id`            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `username`      VARCHAR(64)  NOT NULL,
  `password_hash` VARCHAR(255) NOT NULL,
  `email`         VARCHAR(190) DEFAULT NULL,
  `display_name`  VARCHAR(64)  NOT NULL DEFAULT '',
  `avatar`        VARCHAR(500) DEFAULT NULL,
  `bio`           TEXT,
  `role`          ENUM('admin','editor','member') NOT NULL DEFAULT 'member',
  `email_verified_at` DATETIME DEFAULT NULL,
  `status`        ENUM('active','banned') NOT NULL DEFAULT 'active',
  `preferences`   JSON         DEFAULT NULL,
  `last_login_at` DATETIME     DEFAULT NULL,
  `created_at`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_users_username` (`username`),
  KEY `idx_users_email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- 分类（支持一级/二级） ----------
CREATE TABLE IF NOT EXISTS `categories` (
  `id`          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `parent_id`   INT UNSIGNED DEFAULT NULL,
  `name`        VARCHAR(80)  NOT NULL,
  `slug`        VARCHAR(100) NOT NULL,
  `description` VARCHAR(255) DEFAULT NULL,
  `color`       VARCHAR(20)  DEFAULT NULL,
  `sort_order`  INT NOT NULL DEFAULT 0,
  `created_at`  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_categories_slug` (`slug`),
  KEY `idx_categories_parent` (`parent_id`),
  CONSTRAINT `fk_categories_parent` FOREIGN KEY (`parent_id`) REFERENCES `categories` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- 标签 ----------
CREATE TABLE IF NOT EXISTS `tags` (
  `id`         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name`       VARCHAR(60) NOT NULL,
  `slug`       VARCHAR(80) NOT NULL,
  `color`      VARCHAR(20) DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_tags_slug` (`slug`),
  UNIQUE KEY `uk_tags_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- 文章 ----------
CREATE TABLE IF NOT EXISTS `posts` (
  `id`             INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `title`          VARCHAR(200) NOT NULL,
  `slug`           VARCHAR(220) NOT NULL,
  `summary`        VARCHAR(500) DEFAULT NULL,
  `content`        MEDIUMTEXT NOT NULL,
  `content_format` ENUM('markdown','html') NOT NULL DEFAULT 'markdown',
  `cover_image`    VARCHAR(500) DEFAULT NULL,
  `author_id`      INT UNSIGNED DEFAULT NULL,
  `category_id`    INT UNSIGNED DEFAULT NULL,
  `status`         ENUM('draft','published','scheduled','private') NOT NULL DEFAULT 'draft',
  `is_pinned`      TINYINT(1) NOT NULL DEFAULT 0,
  `is_featured`    TINYINT(1) NOT NULL DEFAULT 0,
  `allow_comment`  TINYINT(1) NOT NULL DEFAULT 1,
  `view_count`     INT UNSIGNED NOT NULL DEFAULT 0,
  `like_count`     INT UNSIGNED NOT NULL DEFAULT 0,
  `word_count`     INT UNSIGNED NOT NULL DEFAULT 0,
  `reading_time`   INT UNSIGNED NOT NULL DEFAULT 0,
  `seo_title`      VARCHAR(200) DEFAULT NULL,
  `seo_description` VARCHAR(500) DEFAULT NULL,
  `published_at`   DATETIME DEFAULT NULL,
  `created_at`     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at`     DATETIME DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_posts_slug` (`slug`),
  KEY `idx_posts_status_pub` (`status`, `published_at`),
  KEY `idx_posts_category` (`category_id`),
  KEY `idx_posts_author` (`author_id`),
  KEY `idx_posts_deleted` (`deleted_at`),
  FULLTEXT KEY `ft_posts` (`title`, `summary`, `content`),
  CONSTRAINT `fk_posts_author` FOREIGN KEY (`author_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_posts_category` FOREIGN KEY (`category_id`) REFERENCES `categories` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- 文章-标签 多对多 ----------
CREATE TABLE IF NOT EXISTS `post_tags` (
  `post_id` INT UNSIGNED NOT NULL,
  `tag_id`  INT UNSIGNED NOT NULL,
  PRIMARY KEY (`post_id`, `tag_id`),
  KEY `idx_post_tags_tag` (`tag_id`),
  CONSTRAINT `fk_pt_post` FOREIGN KEY (`post_id`) REFERENCES `posts` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_pt_tag`  FOREIGN KEY (`tag_id`)  REFERENCES `tags` (`id`)  ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- 独立页面（关于/友链/自定义） ----------
CREATE TABLE IF NOT EXISTS `pages` (
  `id`             INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `title`          VARCHAR(200) NOT NULL,
  `slug`           VARCHAR(220) NOT NULL,
  `content`        MEDIUMTEXT NOT NULL,
  `content_format` ENUM('markdown','html') NOT NULL DEFAULT 'markdown',
  `status`         ENUM('draft','published') NOT NULL DEFAULT 'published',
  `show_in_nav`    TINYINT(1) NOT NULL DEFAULT 0,
  `sort_order`     INT NOT NULL DEFAULT 0,
  `created_at`     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_pages_slug` (`slug`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
-- ---------- 评论（支持楼中楼） ----------
CREATE TABLE IF NOT EXISTS `comments` (
  `id`         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `post_id`    INT UNSIGNED DEFAULT NULL,
  `page_id`    INT UNSIGNED DEFAULT NULL,
  `parent_id`  INT UNSIGNED DEFAULT NULL,
  `author_name`  VARCHAR(80) NOT NULL,
  `author_email` VARCHAR(190) DEFAULT NULL,
  `author_site`  VARCHAR(255) DEFAULT NULL,
  `content`    TEXT NOT NULL,
  `status`     ENUM('pending','approved','spam','rejected') NOT NULL DEFAULT 'pending',
  `ip_hash`    VARCHAR(64) DEFAULT NULL,
  `user_agent` VARCHAR(255) DEFAULT NULL,
  `is_admin`   TINYINT(1) NOT NULL DEFAULT 0,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_comments_post` (`post_id`, `status`, `created_at`),
  KEY `idx_comments_page` (`page_id`, `status`),
  KEY `idx_comments_parent` (`parent_id`),
  CONSTRAINT `fk_comments_post`   FOREIGN KEY (`post_id`)   REFERENCES `posts` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_comments_page`   FOREIGN KEY (`page_id`)   REFERENCES `pages` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_comments_parent` FOREIGN KEY (`parent_id`) REFERENCES `comments` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- 媒体库 ----------
CREATE TABLE IF NOT EXISTS `media` (
  `id`          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `filename`    VARCHAR(255) NOT NULL,
  `stored_name` VARCHAR(255) NOT NULL,
  `url`         VARCHAR(500) NOT NULL,
  `mime`        VARCHAR(100) NOT NULL,
  `size`        INT UNSIGNED NOT NULL DEFAULT 0,
  `width`       INT UNSIGNED DEFAULT NULL,
  `height`      INT UNSIGNED DEFAULT NULL,
  `alt`         VARCHAR(255) DEFAULT NULL,
  `uploader_id` INT UNSIGNED DEFAULT NULL,
  `created_at`  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_media_stored` (`stored_name`),
  KEY `idx_media_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- 键值设置（站点外观、主题等可在管理端修改） ----------
CREATE TABLE IF NOT EXISTS `settings` (
  `key_name`   VARCHAR(100) NOT NULL,
  `value_json` JSON NOT NULL,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`key_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- 友链 ----------
CREATE TABLE IF NOT EXISTS `links` (
  `id`         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name`       VARCHAR(80) NOT NULL,
  `url`        VARCHAR(500) NOT NULL,
  `avatar`     VARCHAR(500) DEFAULT NULL,
  `description` VARCHAR(255) DEFAULT NULL,
  `sort_order` INT NOT NULL DEFAULT 0,
  `visible`    TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- 访问统计（按天聚合，用于后台仪表盘图表） ----------
CREATE TABLE IF NOT EXISTS `page_views` (
  `id`          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `post_id`     INT UNSIGNED DEFAULT NULL,
  `path`        VARCHAR(255) NOT NULL,
  `visitor_key` VARCHAR(64) DEFAULT NULL,
  `referer`     VARCHAR(500) DEFAULT NULL,
  `created_at`  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_pv_post` (`post_id`),
  KEY `idx_pv_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- 操作日志（审计） ----------
CREATE TABLE IF NOT EXISTS `audit_logs` (
  `id`         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id`    INT UNSIGNED DEFAULT NULL,
  `action`     VARCHAR(80) NOT NULL,
  `target`     VARCHAR(120) DEFAULT NULL,
  `detail`     JSON DEFAULT NULL,
  `ip`         VARCHAR(64) DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_audit_user` (`user_id`),
  KEY `idx_audit_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- 刷新令牌（可撤销的登录会话） ----------
CREATE TABLE IF NOT EXISTS `refresh_tokens` (
  `id`         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id`    INT UNSIGNED NOT NULL,
  `token_hash` CHAR(64) NOT NULL,
  `user_agent` VARCHAR(255) DEFAULT NULL,
  `ip`         VARCHAR(64) DEFAULT NULL,
  `expires_at` DATETIME NOT NULL,
  `revoked_at` DATETIME DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_rt_hash` (`token_hash`),
  KEY `idx_rt_user` (`user_id`),
  CONSTRAINT `fk_rt_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- 聊天室消息（room: public 公共 / members 登录用户） ----------
CREATE TABLE IF NOT EXISTS `chat_messages` (
  `id`         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `room`       ENUM('public','members') NOT NULL DEFAULT 'public',
  `user_id`    INT UNSIGNED DEFAULT NULL,
  `nickname`   VARCHAR(64) NOT NULL,
  `avatar`     VARCHAR(500) DEFAULT NULL,
  `content`    VARCHAR(2000) DEFAULT NULL,
  `media_url`  VARCHAR(500) DEFAULT NULL,
  `media_type` ENUM('image','video') DEFAULT NULL,
  `status`     ENUM('visible','hidden') NOT NULL DEFAULT 'visible',
  `ip_hash`    VARCHAR(64) DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_chat_room` (`room`, `id`),
  KEY `idx_chat_user` (`user_id`),
  KEY `idx_chat_created` (`created_at`),
  CONSTRAINT `fk_chat_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- 留言墙（访客可发，支持回复） ----------
CREATE TABLE IF NOT EXISTS `guestbook` (
  `id`         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `parent_id`  INT UNSIGNED DEFAULT NULL,
  `user_id`    INT UNSIGNED DEFAULT NULL,
  `nickname`   VARCHAR(64) NOT NULL,
  `email`      VARCHAR(190) DEFAULT NULL,
  `avatar`     VARCHAR(500) DEFAULT NULL,
  `content`    TEXT NOT NULL,
  `mood`       VARCHAR(16) DEFAULT NULL,
  `status`     ENUM('pending','approved','hidden') NOT NULL DEFAULT 'approved',
  `is_admin`   TINYINT(1) NOT NULL DEFAULT 0,
  `ip_hash`    VARCHAR(64) DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_gb_status` (`status`, `created_at`),
  KEY `idx_gb_parent` (`parent_id`),
  CONSTRAINT `fk_gb_parent` FOREIGN KEY (`parent_id`) REFERENCES `guestbook` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- 邮件令牌（邮箱验证 / 找回密码） ----------
CREATE TABLE IF NOT EXISTS `email_tokens` (
  `id`         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id`    INT UNSIGNED NOT NULL,
  `purpose`    ENUM('verify','reset') NOT NULL,
  `token_hash` CHAR(64) NOT NULL,
  `expires_at` DATETIME NOT NULL,
  `used_at`    DATETIME DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_et_hash` (`token_hash`),
  KEY `idx_et_user` (`user_id`, `purpose`),
  CONSTRAINT `fk_et_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
