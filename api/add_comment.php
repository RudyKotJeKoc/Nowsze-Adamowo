<?php
/**
 * Add Comment API for Radio Adamowo
 * Handles comment submission with XSS/CSRF protection
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
$rate_limit_key = "comment_rate_limit_" . hash('md5', $client_ip);

// Check rate limit (max 5 comments per 10 minutes)
if (isset($_SESSION[$rate_limit_key])) {
    $requests = $_SESSION[$rate_limit_key];
    if ($requests['count'] >= 5 && (time() - $requests['timestamp']) < 600) {
        http_response_code(429);
        echo json_encode([
            'success' => false,
            'error' => 'Rate limit exceeded',
            'message' => 'Too many comments. Please wait before posting again.'
        ]);
        exit;
    }
    
    // Reset counter if 10 minutes have passed
    if ((time() - $requests['timestamp']) >= 600) {
        $_SESSION[$rate_limit_key] = ['count' => 0, 'timestamp' => time()];
    }
} else {
    $_SESSION[$rate_limit_key] = ['count' => 0, 'timestamp' => time()];
}

class CommentManager {
    private $db;
    
    public function __construct() {
        $this->db = DatabaseConfig::getInstance();
    }
    
    /**
     * Validate CSRF token
     */
    private function validateCSRFToken($token) {
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
            error_log("CSRF validation failed: " . $e->getMessage());
            return false;
        }
    }
    
    /**
     * Mark CSRF token as used
     */
    private function markTokenUsed($token) {
        try {
            $this->db->query(
                "UPDATE csrf_tokens SET used_at = NOW() WHERE token = ?",
                [$token]
            );
        } catch (Exception $e) {
            error_log("Failed to mark token as used: " . $e->getMessage());
        }
    }
    
    /**
     * Sanitize and validate input data
     */
    private function validateInput($data) {
        $errors = [];
        
        // Validate name
        if (empty($data['name'])) {
            $errors[] = 'Name is required';
        } elseif (strlen($data['name']) > 100) {
            $errors[] = 'Name must be less than 100 characters';
        }
        
        // Validate email
        if (empty($data['email'])) {
            $errors[] = 'Email is required';
        } elseif (!filter_var($data['email'], FILTER_VALIDATE_EMAIL)) {
            $errors[] = 'Invalid email address';
        } elseif (strlen($data['email']) > 255) {
            $errors[] = 'Email must be less than 255 characters';
        }
        
        // Validate comment
        if (empty($data['comment'])) {
            $errors[] = 'Comment is required';
        } elseif (strlen($data['comment']) < 10) {
            $errors[] = 'Comment must be at least 10 characters';
        } elseif (strlen($data['comment']) > 2000) {
            $errors[] = 'Comment must be less than 2000 characters';
        }
        
        // Validate section
        $allowed_sections = ['player', 'laboratory', 'resistance', 'games', 'museum', 'achievements', 'general'];
        if (!empty($data['section']) && !in_array($data['section'], $allowed_sections)) {
            $data['section'] = 'general';
        }
        
        return [
            'valid' => empty($errors),
            'errors' => $errors,
            'data' => [
                'name' => DatabaseConfig::sanitizeString($data['name'] ?? ''),
                'email' => filter_var($data['email'] ?? '', FILTER_SANITIZE_EMAIL),
                'comment' => DatabaseConfig::sanitizeString($data['comment'] ?? ''),
                'section' => $data['section'] ?? 'general'
            ]
        ];
    }
    
    /**
     * Check for spam/harmful content
     */
    private function isSpam($data) {
        $content = strtolower($data['name'] . ' ' . $data['email'] . ' ' . $data['comment']);
        
        // Common spam patterns
        $spam_patterns = [
            '/\b(viagra|cialis|casino|poker|loan|mortgage)\b/',
            '/\b(click here|visit now|buy now|free money)\b/',
            '/http[s]?:\/\/[^\s]+\.(tk|ml|ga|cf)/',  // Suspicious TLDs
            '/\b\d{10,}\b/',  // Long number sequences
            '/[^\w\s]{5,}/',  // Too many special characters
        ];
        
        foreach ($spam_patterns as $pattern) {
            if (preg_match($pattern, $content)) {
                return true;
            }
        }
        
        // Check for repeated characters/words
        if (preg_match('/(.)\1{10,}/', $content)) {
            return true;
        }
        
        return false;
    }
    
    /**
     * Add comment to database
     */
    public function addComment($data) {
        try {
            // Validate input
            $validation = $this->validateInput($data);
            if (!$validation['valid']) {
                return [
                    'success' => false,
                    'error' => 'Validation failed',
                    'messages' => $validation['errors']
                ];
            }
            
            $clean_data = $validation['data'];
            
            // Check for spam
            if ($this->isSpam($clean_data)) {
                // Log potential spam but don't tell the user
                error_log("Potential spam comment from IP: " . $this->getClientIP());
                
                return [
                    'success' => true,
                    'message' => 'Comment submitted successfully and is pending moderation',
                    'id' => -1  // Fake ID for spam
                ];
            }
            
            // Get client info
            $ip_address = $this->getClientIP();
            $user_agent = $_SERVER['HTTP_USER_AGENT'] ?? '';
            
            // Insert comment
            $stmt = $this->db->query(
                "INSERT INTO comments (name, email, comment, section, ip_address, user_agent) VALUES (?, ?, ?, ?, ?, ?)",
                [
                    $clean_data['name'],
                    $clean_data['email'],
                    $clean_data['comment'],
                    $clean_data['section'],
                    $ip_address,
                    $user_agent
                ]
            );
            
            $comment_id = $this->db->lastInsertId();
            
            return [
                'success' => true,
                'message' => 'Comment submitted successfully and is pending moderation',
                'id' => $comment_id
            ];
            
        } catch (Exception $e) {
            error_log("Comment submission failed: " . $e->getMessage());
            return [
                'success' => false,
                'error' => 'Submission failed',
                'message' => 'Unable to save comment. Please try again.'
            ];
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
                
                if (filter_var($ip, FILTER_VALIDATE_IP)) {
                    return $ip;
                }
            }
        }
        
        return $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
    }
}

// Handle the request
try {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        http_response_code(405);
        echo json_encode([
            'success' => false,
            'error' => 'Method not allowed',
            'message' => 'Only POST requests are allowed'
        ]);
        exit;
    }
    
    // Get POST data
    $input = file_get_contents('php://input');
    $data = json_decode($input, true);
    
    if (json_last_error() !== JSON_ERROR_NONE) {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'error' => 'Invalid JSON',
            'message' => 'Request body must be valid JSON'
        ]);
        exit;
    }
    
    // Validate CSRF token
    $csrf_token = $data['csrf_token'] ?? '';
    $comment_manager = new CommentManager();
    
    if (!$comment_manager->validateCSRFToken($csrf_token)) {
        http_response_code(403);
        echo json_encode([
            'success' => false,
            'error' => 'Invalid CSRF token',
            'message' => 'Security token is invalid or expired'
        ]);
        exit;
    }
    
    // Mark token as used
    $comment_manager->markTokenUsed($csrf_token);
    
    // Increment rate limit counter
    $_SESSION[$rate_limit_key]['count']++;
    
    // Process comment
    $result = $comment_manager->addComment($data);
    
    echo json_encode($result);
    
} catch (Exception $e) {
    error_log("Comment API error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'Internal server error',
        'message' => 'Unable to process request'
    ]);
}
?>