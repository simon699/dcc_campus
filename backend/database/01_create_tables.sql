-- Create users table
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    password VARCHAR(64) NOT NULL,
    phone VARCHAR(20) NOT NULL UNIQUE,
    organization_id VARCHAR(20) NOT NULL,
    dcc_user VARCHAR(100) DEFAULT NULL,
    dcc_user_org_id VARCHAR(100) DEFAULT NULL,
    create_time DATETIME NOT NULL,
    user_role INT NOT NULL,
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Create initial user, password is SHA256 hash of admin123
INSERT INTO users (username, password, phone, organization_id, create_time, user_role) 
VALUES ('admin', '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9', '13800000000', 'ORG001', NOW(), 1)
ON DUPLICATE KEY UPDATE id=id;

-- Create organizations table
CREATE TABLE IF NOT EXISTS organizations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    organization_id VARCHAR(20) NOT NULL UNIQUE,
    organization_type INT NOT NULL,
    create_time DATETIME NOT NULL,
    end_time DATETIME NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


