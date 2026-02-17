-- ============================================
-- Desktop Calendar 릴리스 관리 테이블
-- ============================================

-- 릴리스 정보 테이블
CREATE TABLE IF NOT EXISTS releases (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    version VARCHAR(50) NOT NULL COMMENT '버전 (예: 1.0.0)',
    platform VARCHAR(20) NOT NULL COMMENT '플랫폼 (windows, macos, linux)',
    file_name VARCHAR(255) NOT NULL COMMENT '파일명',
    download_url TEXT NOT NULL COMMENT 'S3 다운로드 URL',
    file_size BIGINT NOT NULL COMMENT '파일 크기 (bytes)',
    checksum VARCHAR(64) NOT NULL COMMENT 'SHA256 체크섬',
    release_notes TEXT COMMENT '릴리스 노트',
    is_prerelease BOOLEAN DEFAULT FALSE COMMENT '프리릴리스 여부',
    download_count INT DEFAULT 0 COMMENT '다운로드 횟수',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '생성일시',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '수정일시',

    INDEX idx_platform_created (platform, created_at DESC),
    INDEX idx_version (version),
    INDEX idx_platform_version (platform, version),
    UNIQUE KEY unique_platform_version (platform, version)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='앱 릴리스 정보';

-- 다운로드 로그 테이블 (선택적)
CREATE TABLE IF NOT EXISTS release_downloads (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    release_id BIGINT NOT NULL,
    ip_address VARCHAR(45) COMMENT '다운로드 IP',
    user_agent TEXT COMMENT 'User Agent',
    country VARCHAR(2) COMMENT '국가 코드 (ISO 3166-1 alpha-2)',
    downloaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '다운로드 일시',

    INDEX idx_release_id (release_id),
    INDEX idx_downloaded_at (downloaded_at DESC),
    FOREIGN KEY (release_id) REFERENCES releases(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='릴리스 다운로드 로그';

-- ============================================
-- 초기 데이터 샘플 (선택적)
-- ============================================

-- INSERT INTO releases (version, platform, file_name, download_url, file_size, checksum, release_notes, is_prerelease) VALUES
-- ('1.0.0', 'windows', 'desktop-calendar-1.0.0-windows-x64.zip', 'https://s3.amazonaws.com/...', 52428800, 'abc123...', 'Initial release', FALSE),
-- ('1.0.0', 'macos', 'desktop-calendar-1.0.0-macos-universal.zip', 'https://s3.amazonaws.com/...', 52428800, 'def456...', 'Initial release', FALSE),
-- ('1.0.0', 'linux', 'desktop-calendar-1.0.0-linux-x64.zip', 'https://s3.amazonaws.com/...', 52428800, 'ghi789...', 'Initial release', FALSE);

-- ============================================
-- 유용한 쿼리
-- ============================================

-- 플랫폼별 최신 릴리스 조회
-- SELECT * FROM releases
-- WHERE platform = 'windows' AND is_prerelease = FALSE
-- ORDER BY created_at DESC
-- LIMIT 1;

-- 모든 플랫폼의 최신 버전 조회
-- SELECT platform, version, download_url, created_at
-- FROM releases r1
-- WHERE created_at = (
--     SELECT MAX(created_at)
--     FROM releases r2
--     WHERE r2.platform = r1.platform AND r2.is_prerelease = FALSE
-- )
-- ORDER BY platform;

-- 다운로드 통계 (일별)
-- SELECT DATE(downloaded_at) as date, COUNT(*) as downloads
-- FROM release_downloads
-- GROUP BY DATE(downloaded_at)
-- ORDER BY date DESC;

-- 플랫폼별 다운로드 통계
-- SELECT r.platform, r.version, COUNT(rd.id) as downloads
-- FROM releases r
-- LEFT JOIN release_downloads rd ON r.id = rd.release_id
-- GROUP BY r.platform, r.version
-- ORDER BY r.created_at DESC;

