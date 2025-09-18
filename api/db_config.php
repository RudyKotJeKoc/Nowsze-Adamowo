<?php
/**
 * Database Configuration for Radio Adamowo
 * Secure MySQL connection configuration
 */

// Prevent direct access
if (!defined('RADIO_ADAMOWO_API')) {
    http_response_code(403);
    exit('Access denied');
}

// Database configuration
class DatabaseConfig {
    // Database connection parameters
    private const DB_HOST = 'localhost';
    private const DB_NAME = 'radio_adamowo';
    private const DB_USER = 'radio_user';
    private const DB_PASS = 'secure_password_2024!';
    private const DB_CHARSET = 'utf8mb4';
    
    // Connection options for security
    private const PDO_OPTIONS = [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
        PDO::MYSQL_ATTR_INIT_COMMAND => "SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci"
    ];
    
    private static $instance = null;
    private $connection = null;
    
    /**
     * Singleton pattern for database connection
     */
    private function __construct() {
        $this->connect();
    }
    
    /**
     * Get database instance
     */
    public static function getInstance() {
        if (self::$instance === null) {
            self::$instance = new self();
        }
        return self::$instance;
    }
    
    /**
     * Establish database connection
     */
    private function connect() {
        try {
            $dsn = sprintf(
                "mysql:host=%s;dbname=%s;charset=%s",
                self::DB_HOST,
                self::DB_NAME,
                self::DB_CHARSET
            );
            
            $this->connection = new PDO($dsn, self::DB_USER, self::DB_PASS, self::PDO_OPTIONS);
            
            // Set timezone
            $this->connection->exec("SET time_zone = '+00:00'");
            
        } catch (PDOException $e) {
            error_log("Database connection error: " . $e->getMessage());
            http_response_code(500);
            exit('Database connection failed');
        }
    }
    
    /**
     * Get database connection
     */
    public function getConnection() {
        if ($this->connection === null) {
            $this->connect();
        }
        return $this->connection;
    }
    
    /**
     * Check if database connection is alive
     */
    public function isConnected() {
        try {
            if ($this->connection === null) {
                return false;
            }
            $this->connection->query('SELECT 1');
            return true;
        } catch (PDOException $e) {
            return false;
        }
    }
    
    /**
     * Execute query with parameters
     */
    public function query($sql, $params = []) {
        try {
            $stmt = $this->connection->prepare($sql);
            $stmt->execute($params);
            return $stmt;
        } catch (PDOException $e) {
            error_log("Query error: " . $e->getMessage() . " SQL: " . $sql);
            throw new Exception('Query execution failed');
        }
    }
    
    /**
     * Get last insert ID
     */
    public function lastInsertId() {
        return $this->connection->lastInsertId();
    }
    
    /**
     * Begin transaction
     */
    public function beginTransaction() {
        return $this->connection->beginTransaction();
    }
    
    /**
     * Commit transaction
     */
    public function commit() {
        return $this->connection->commit();
    }
    
    /**
     * Rollback transaction
     */
    public function rollback() {
        return $this->connection->rollback();
    }
    
    /**
     * Sanitize input string
     */
    public static function sanitizeString($input) {
        return trim(strip_tags($input));
    }
    
    /**
     * Validate email
     */
    public static function validateEmail($email) {
        return filter_var($email, FILTER_VALIDATE_EMAIL);
    }
    
    /**
     * Generate secure hash
     */
    public static function generateHash($data) {
        return hash('sha256', $data . 'radio_adamowo_salt_2024');
    }
    
    /**
     * Create tables if they don't exist
     */
    public function createTables() {
        $tables = [
            'comments' => "
                CREATE TABLE IF NOT EXISTS comments (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    name VARCHAR(100) NOT NULL,
                    email VARCHAR(255) NOT NULL,
                    comment TEXT NOT NULL,
                    section VARCHAR(50) NOT NULL DEFAULT 'general',
                    status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
                    ip_address VARCHAR(45) NOT NULL,
                    user_agent TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    INDEX idx_status (status),
                    INDEX idx_section (section),
                    INDEX idx_created (created_at)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            ",
            'csrf_tokens' => "
                CREATE TABLE IF NOT EXISTS csrf_tokens (
                    token VARCHAR(64) PRIMARY KEY,
                    expires_at TIMESTAMP NOT NULL,
                    used_at TIMESTAMP NULL,
                    ip_address VARCHAR(45) NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    INDEX idx_expires (expires_at),
                    INDEX idx_ip (ip_address)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            ",
            'user_sessions' => "
                CREATE TABLE IF NOT EXISTS user_sessions (
                    session_id VARCHAR(128) PRIMARY KEY,
                    user_data JSON,
                    language VARCHAR(10) DEFAULT 'pl',
                    last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    ip_address VARCHAR(45) NOT NULL,
                    user_agent TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    INDEX idx_activity (last_activity),
                    INDEX idx_ip (ip_address)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            "
        ];
        
        foreach ($tables as $tableName => $sql) {
            try {
                $this->connection->exec($sql);
                error_log("Table '$tableName' created or verified");
            } catch (PDOException $e) {
                error_log("Failed to create table '$tableName': " . $e->getMessage());
                throw new Exception("Database setup failed");
            }
        }
    }
    
    /**
     * Clean expired tokens and sessions
     */
    public function cleanupExpired() {
        try {
            // Clean expired CSRF tokens
            $this->query("DELETE FROM csrf_tokens WHERE expires_at < NOW()");
            
            // Clean old sessions (older than 24 hours)
            $this->query("DELETE FROM user_sessions WHERE last_activity < DATE_SUB(NOW(), INTERVAL 24 HOUR)");
            
        } catch (Exception $e) {
            error_log("Cleanup failed: " . $e->getMessage());
        }
    }
}

// Auto-create tables on first load
try {
    $db = DatabaseConfig::getInstance();
    $db->createTables();
    $db->cleanupExpired();
} catch (Exception $e) {
    error_log("Database initialization failed: " . $e->getMessage());
}
?>