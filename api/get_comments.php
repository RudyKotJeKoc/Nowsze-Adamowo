<?php
/**
 * Get Comments API for Radio Adamowo
 * Retrieves approved comments with pagination
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

class CommentRetriever {
    private $db;
    
    public function __construct() {
        $this->db = DatabaseConfig::getInstance();
    }
    
    /**
     * Get comments with pagination and filtering
     */
    public function getComments($section = 'general', $page = 1, $per_page = 10, $order = 'desc') {
        try {
            // Validate parameters
            $section = $this->validateSection($section);
            $page = max(1, intval($page));
            $per_page = max(1, min(50, intval($per_page))); // Max 50 comments per page
            $order = in_array(strtolower($order), ['asc', 'desc']) ? strtolower($order) : 'desc';
            
            // Calculate offset
            $offset = ($page - 1) * $per_page;
            
            // Get total count
            $count_stmt = $this->db->query(
                "SELECT COUNT(*) as total FROM comments WHERE status = 'approved' AND (section = ? OR ? = 'all')",
                [$section, $section]
            );
            $total_count = $count_stmt->fetch()['total'];
            
            // Get comments
            $comments_stmt = $this->db->query(
                "SELECT 
                    id,
                    name,
                    comment,
                    section,
                    created_at,
                    DATE_FORMAT(created_at, '%Y-%m-%d %H:%i') as formatted_date
                FROM comments 
                WHERE status = 'approved' AND (section = ? OR ? = 'all')
                ORDER BY created_at {$order}
                LIMIT ? OFFSET ?",
                [$section, $section, $per_page, $offset]
            );
            
            $comments = $comments_stmt->fetchAll();
            
            // Process comments for safe output
            foreach ($comments as &$comment) {
                $comment['comment'] = $this->processCommentText($comment['comment']);
                $comment['name'] = htmlspecialchars($comment['name'], ENT_QUOTES, 'UTF-8');
                $comment['time_ago'] = $this->timeAgo($comment['created_at']);
            }
            
            // Calculate pagination info
            $total_pages = ceil($total_count / $per_page);
            
            return [
                'success' => true,
                'data' => [
                    'comments' => $comments,
                    'pagination' => [
                        'current_page' => $page,
                        'per_page' => $per_page,
                        'total_count' => intval($total_count),
                        'total_pages' => $total_pages,
                        'has_next' => $page < $total_pages,
                        'has_prev' => $page > 1
                    ],
                    'section' => $section,
                    'order' => $order
                ]
            ];
            
        } catch (Exception $e) {
            error_log("Comment retrieval failed: " . $e->getMessage());
            return [
                'success' => false,
                'error' => 'Retrieval failed',
                'message' => 'Unable to load comments'
            ];
        }
    }
    
    /**
     * Get comment statistics
     */
    public function getCommentStats() {
        try {
            // Get stats by section
            $stats_stmt = $this->db->query(
                "SELECT 
                    section,
                    COUNT(*) as count,
                    MAX(created_at) as last_comment
                FROM comments 
                WHERE status = 'approved'
                GROUP BY section
                ORDER BY count DESC"
            );
            
            $stats = $stats_stmt->fetchAll();
            
            // Get total approved comments
            $total_stmt = $this->db->query(
                "SELECT COUNT(*) as total FROM comments WHERE status = 'approved'"
            );
            $total = $total_stmt->fetch()['total'];
            
            // Get recent activity (last 24 hours)
            $recent_stmt = $this->db->query(
                "SELECT COUNT(*) as recent FROM comments WHERE status = 'approved' AND created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)"
            );
            $recent = $recent_stmt->fetch()['recent'];
            
            return [
                'success' => true,
                'data' => [
                    'total_comments' => intval($total),
                    'recent_comments' => intval($recent),
                    'by_section' => $stats,
                    'generated_at' => date('c')
                ]
            ];
            
        } catch (Exception $e) {
            error_log("Comment stats retrieval failed: " . $e->getMessage());
            return [
                'success' => false,
                'error' => 'Stats unavailable',
                'message' => 'Unable to load comment statistics'
            ];
        }
    }
    
    /**
     * Validate section parameter
     */
    private function validateSection($section) {
        $allowed_sections = ['player', 'laboratory', 'resistance', 'games', 'museum', 'achievements', 'general', 'all'];
        return in_array($section, $allowed_sections) ? $section : 'general';
    }
    
    /**
     * Process comment text for safe display
     */
    private function processCommentText($text) {
        // Escape HTML
        $text = htmlspecialchars($text, ENT_QUOTES, 'UTF-8');
        
        // Convert URLs to links (simple implementation)
        $text = preg_replace(
            '/https?:\/\/[^\s<>"\']+/',
            '<a href="$0" target="_blank" rel="noopener noreferrer">$0</a>',
            $text
        );
        
        // Convert line breaks to <br>
        $text = nl2br($text);
        
        // Limit length for display (with full text in data attribute if needed)
        if (strlen($text) > 500) {
            $short_text = substr(strip_tags($text), 0, 497) . '...';
            return $short_text;
        }
        
        return $text;
    }
    
    /**
     * Generate human-readable time ago string
     */
    private function timeAgo($datetime) {
        $time = strtotime($datetime);
        $now = time();
        $diff = $now - $time;
        
        if ($diff < 60) {
            return 'właśnie teraz';
        } elseif ($diff < 3600) {
            $minutes = floor($diff / 60);
            return $minutes . ' min temu';
        } elseif ($diff < 86400) {
            $hours = floor($diff / 3600);
            return $hours . ' godz temu';
        } elseif ($diff < 2592000) {
            $days = floor($diff / 86400);
            return $days . ' dni temu';
        } elseif ($diff < 31536000) {
            $months = floor($diff / 2592000);
            return $months . ' mies temu';
        } else {
            $years = floor($diff / 31536000);
            return $years . ' lat temu';
        }
    }
}

// Rate limiting for GET requests (more lenient)
session_start();
$client_ip = $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
$rate_limit_key = "get_comments_rate_limit_" . hash('md5', $client_ip);

// Check rate limit (max 60 requests per minute)
if (isset($_SESSION[$rate_limit_key])) {
    $requests = $_SESSION[$rate_limit_key];
    if ($requests['count'] >= 60 && (time() - $requests['timestamp']) < 60) {
        http_response_code(429);
        echo json_encode([
            'success' => false,
            'error' => 'Rate limit exceeded',
            'message' => 'Too many requests. Please wait before trying again.'
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
    
    // Get parameters
    $section = $_GET['section'] ?? 'general';
    $page = $_GET['page'] ?? 1;
    $per_page = $_GET['per_page'] ?? 10;
    $order = $_GET['order'] ?? 'desc';
    $stats_only = isset($_GET['stats_only']) && $_GET['stats_only'] === 'true';
    
    $retriever = new CommentRetriever();
    
    if ($stats_only) {
        $result = $retriever->getCommentStats();
    } else {
        $result = $retriever->getComments($section, $page, $per_page, $order);
    }
    
    // Add cache headers for successful responses
    if ($result['success']) {
        header('Cache-Control: public, max-age=300'); // Cache for 5 minutes
        header('ETag: "' . md5(serialize($result)) . '"');
        
        // Check ETag
        $client_etag = $_SERVER['HTTP_IF_NONE_MATCH'] ?? '';
        $server_etag = '"' . md5(serialize($result)) . '"';
        
        if ($client_etag === $server_etag) {
            http_response_code(304);
            exit;
        }
    }
    
    echo json_encode($result);
    
} catch (Exception $e) {
    error_log("Get comments API error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'Internal server error',
        'message' => 'Unable to process request'
    ]);
}
?>