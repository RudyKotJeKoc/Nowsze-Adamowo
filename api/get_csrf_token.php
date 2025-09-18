<?php
/**
 * CSRF Token Generator for Radio Adamowo
 * Generates and validates CSRF tokens for form security
 */

// Security headers
header('Content-Type: application/json');
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');
header('X-XSS-Protection: 1; mode=block');

// Define API constant
define('RADIO_ADAMOWO_API', true);

// Include database configuration
require_once 'db_config.php';

// Rate limiting
session_start();
$client_ip = $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
$rate_limit_key = "csrf_rate_limit_" . hash('md5', $client_ip);

// Check rate limit (max 10 tokens per minute)
if (isset($_SESSION[$rate_limit_key])) {
    $requests = $_SESSION[$rate_limit_key];
    if ($requests['count'] >= 10 && (time() - $requests['timestamp']) < 60) {
        http_response_code(429);
        echo json_encode([
            'success' => false,
            'error' => 'Rate limit exceeded',
            'message' => 'Too many token requests. Try again later.'
        ]);
        exit;
    }
    
    // Reset counter if minute has passed
    if ((time() - $requests['timestamp']) >= 60) {
        $_SESSION[$rate_limit_key] = ['count' => 0, 'timestamp' => time()];
    }
} else {
    $_SESSION[$rate_limit_key] = ['count' => 0, 'timestamp' => time()];
}

// Increment request counter
$_SESSION[$rate_limit_key]['count']++;

class CSRFTokenManager {
    private $db;
    
    public function __construct() {
        $this->db = DatabaseConfig::getInstance();
    }
    
    /**
     * Generate a new CSRF token
     */
    public function generateToken($expires_in_minutes = 30) {
        try {
            // Generate cryptographically secure token
            $token = bin2hex(random_bytes(32));
            
            // Calculate expiration time
            $expires_at = date('Y-m-d H:i:s', time() + ($expires_in_minutes * 60));
            
            // Get client info
            $ip_address = $this->getClientIP();
            
            // Store token in database
            $this->db->query(
                "INSERT INTO csrf_tokens (token, expires_at, ip_address) VALUES (?, ?, ?)",
                [$token, $expires_at, $ip_address]
            );
            
            // Store in session as backup
            $_SESSION['csrf_token'] = $token;
            $_SESSION['csrf_expires'] = time() + ($expires_in_minutes * 60);
            
            return [
                'success' => true,
                'token' => $token,
                'expires_at' => $expires_at,
                'expires_in' => $expires_in_minutes * 60
            ];
            
        } catch (Exception $e) {
            error_log("CSRF token generation failed: " . $e->getMessage());
            return [
                'success' => false,
                'error' => 'Token generation failed',
                'message' => 'Unable to generate security token'
            ];
        }
    }
    
    /**
     * Validate CSRF token
     */
    public function validateToken($token) {
        if (empty($token)) {
            return false;
        }
        
        try {
            // Check in database
            $stmt = $this->db->query(
                "SELECT token FROM csrf_tokens WHERE token = ? AND expires_at > NOW() AND used_at IS NULL",
                [$token]
            );
            
            $db_token = $stmt->fetch();
            
            // Check session backup
            $session_valid = isset($_SESSION['csrf_token']) && 
                            $_SESSION['csrf_token'] === $token &&
                            isset($_SESSION['csrf_expires']) &&
                            $_SESSION['csrf_expires'] > time();
            
            return $db_token || $session_valid;
            
        } catch (Exception $e) {
            error_log("CSRF token validation failed: " . $e->getMessage());
            return false;
        }
    }
    
    /**
     * Mark token as used
     */
    public function markTokenUsed($token) {
        try {
            $this->db->query(
                "UPDATE csrf_tokens SET used_at = NOW() WHERE token = ?",
                [$token]
            );
            
            // Clear from session
            unset($_SESSION['csrf_token']);
            unset($_SESSION['csrf_expires']);
            
        } catch (Exception $e) {
            error_log("Failed to mark token as used: " . $e->getMessage());
        }
    }
    
    /**
     * Get client IP address
     */
    private function getClientIP() {
        $ip_keys = ['HTTP_CLIENT_IP', 'HTTP_X_FORWARDED_FOR', 'REMOTE_ADDR'];
        
        foreach ($ip_keys as $key) {
            if (array_key_exists($key, $_SERVER) === true) {
                $ip = $_SERVER[$key];
                if (strpos($ip, ',') !== false) {
                    $ip = explode(',', $ip)[0];
                }
                $ip = trim($ip);
                
                if (filter_var($ip, FILTER_VALIDATE_IP, 
                    FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE)) {
                    return $ip;
                }
            }
        }
        
        return $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
    }
    
    /**
     * Clean expired tokens
     */
    public function cleanupExpiredTokens() {
        try {
            $this->db->query("DELETE FROM csrf_tokens WHERE expires_at < NOW()");
        } catch (Exception $e) {
            error_log("Failed to cleanup expired tokens: " . $e->getMessage());
        }
    }
}

// Handle the request
try {
    if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
        http_response_code(405);
        echo json_encode([
            'success' => false,
            'error' => 'Method not allowed',
            'message' => 'Only GET requests are allowed'
        ]);
        exit;
    }
    
    $csrf_manager = new CSRFTokenManager();
    
    // Clean expired tokens periodically (10% chance)
    if (rand(1, 10) === 1) {
        $csrf_manager->cleanupExpiredTokens();
    }
    
    // Generate new token
    $result = $csrf_manager->generateToken();
    
    // Add additional security info
    $result['timestamp'] = time();
    $result['domain'] = $_SERVER['HTTP_HOST'] ?? 'localhost';
    
    echo json_encode($result);
    
} catch (Exception $e) {
    error_log("CSRF endpoint error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'Internal server error',
        'message' => 'Unable to process request'
    ]);
}
?>