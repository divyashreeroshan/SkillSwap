import express from 'express';
import sqlite3 from 'sqlite3';
import bcrypt from 'bcryptjs';
import session from 'express-session';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

// Database setup
const db = new sqlite3.Database('skillswap.db');

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use(session({
  secret: 'skill-swap-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 } // 24 hours
}));

// Initialize database
db.serialize(() => {
  // Users table
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    name TEXT,
    location TEXT,
    profile_photo TEXT,
    availability TEXT,
    is_public BOOLEAN DEFAULT 1,
    is_admin BOOLEAN DEFAULT 0,
    is_banned BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Skills table
  db.run(`CREATE TABLE IF NOT EXISTS skills (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    skill_name TEXT NOT NULL,
    skill_type TEXT NOT NULL CHECK(skill_type IN ('offered', 'wanted')),
    description TEXT,
    level TEXT CHECK(level IN ('Beginner', 'Intermediate', 'Advanced')),
    FOREIGN KEY(user_id) REFERENCES users(id)
  )`);

  // Swap requests table
  db.run(`CREATE TABLE IF NOT EXISTS swap_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    requester_id INTEGER,
    requested_id INTEGER,
    offered_skill TEXT,
    wanted_skill TEXT,
    message TEXT,
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'accepted', 'rejected', 'completed', 'cancelled')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(requester_id) REFERENCES users(id),
    FOREIGN KEY(requested_id) REFERENCES users(id)
  )`);

  // Ratings table
  db.run(`CREATE TABLE IF NOT EXISTS ratings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    swap_id INTEGER,
    rater_id INTEGER,
    rated_id INTEGER,
    rating INTEGER CHECK(rating >= 1 AND rating <= 5),
    feedback TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(swap_id) REFERENCES swap_requests(id),
    FOREIGN KEY(rater_id) REFERENCES users(id),
    FOREIGN KEY(rated_id) REFERENCES users(id)
  )`);

  // Admin messages table
  db.run(`CREATE TABLE IF NOT EXISTS admin_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Insert mock admin user
  const adminPassword = bcrypt.hashSync('admin123', 10);
  db.run(`INSERT OR IGNORE INTO users (username, email, password, name, is_admin) 
          VALUES ('admin', 'admin@skillswap.com', ?, 'Administrator', 1)`, [adminPassword]);

  // Insert mock users
  const mockUsers = [
    {
      username: 'sarah_dev',
      email: 'sarah@example.com',
      password: bcrypt.hashSync('password123', 10),
      name: 'Sarah Johnson',
      location: 'San Francisco, CA',
      availability: 'Weekends, Evenings'
    },
    {
      username: 'mike_designer',
      email: 'mike@example.com',
      password: bcrypt.hashSync('password123', 10),
      name: 'Mike Chen',
      location: 'New York, NY',
      availability: 'Weekdays after 6PM'
    }
  ];

  mockUsers.forEach(user => {
    db.run(`INSERT OR IGNORE INTO users (username, email, password, name, location, availability) 
            VALUES (?, ?, ?, ?, ?, ?)`, 
            [user.username, user.email, user.password, user.name, user.location, user.availability], 
            function(err) {
              if (!err && this.lastID) {
                // Add skills for Sarah
                if (user.username === 'sarah_dev') {
                  db.run(`INSERT INTO skills (user_id, skill_name, skill_type, description, level) VALUES 
                          (?, 'JavaScript', 'offered', 'Full-stack JavaScript development', 'Advanced'),
                          (?, 'React', 'offered', 'Modern React applications', 'Advanced'),
                          (?, 'Graphic Design', 'wanted', 'UI/UX design principles', 'Beginner')`, 
                          [this.lastID, this.lastID, this.lastID]);
                }
                // Add skills for Mike
                if (user.username === 'mike_designer') {
                  db.run(`INSERT INTO skills (user_id, skill_name, skill_type, description, level) VALUES 
                          (?, 'Photoshop', 'offered', 'Professional photo editing', 'Advanced'),
                          (?, 'Illustrator', 'offered', 'Vector graphics and logos', 'Advanced'),
                          (?, 'Node.js', 'wanted', 'Backend development', 'Beginner')`, 
                          [this.lastID, this.lastID, this.lastID]);
                }
              }
            });
  });
});

// Authentication middleware
const requireAuth = (req, res, next) => {
  if (req.session.userId) {
    next();
  } else {
    res.status(401).json({ error: 'Authentication required' });
  }
};

const requireAdmin = (req, res, next) => {
  if (req.session.userId && req.session.isAdmin) {
    next();
  } else {
    res.status(403).json({ error: 'Admin access required' });
  }
};

// Routes

// Serve static files
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// Authentication routes
app.post('/api/register', async (req, res) => {
  const { username, email, password, name } = req.body;
  
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    db.run(
      'INSERT INTO users (username, email, password, name) VALUES (?, ?, ?, ?)',
      [username, email, hashedPassword, name],
      function(err) {
        if (err) {
          if (err.message.includes('UNIQUE constraint failed')) {
            res.status(400).json({ error: 'Username or email already exists' });
          } else {
            res.status(500).json({ error: 'Registration failed' });
          }
        } else {
          req.session.userId = this.lastID;
          req.session.username = username;
          req.session.isAdmin = false;
          res.json({ success: true, userId: this.lastID });
        }
      }
    );
  } catch (error) {
    res.status(500).json({ error: 'Registration failed' });
  }
});

app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  
  db.get(
    'SELECT * FROM users WHERE username = ? AND is_banned = 0',
    [username],
    async (err, user) => {
      if (err || !user) {
        res.status(401).json({ error: 'Invalid credentials' });
        return;
      }
      
      const validPassword = await bcrypt.compare(password, user.password);
      if (!validPassword) {
        res.status(401).json({ error: 'Invalid credentials' });
        return;
      }
      
      req.session.userId = user.id;
      req.session.username = user.username;
      req.session.isAdmin = user.is_admin;
      
      res.json({ 
        success: true, 
        userId: user.id, 
        isAdmin: user.is_admin,
        redirectTo: user.is_admin ? '/admin.html' : '/dashboard.html'
      });
    }
  );
});

app.post('/api/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

// Profile routes
app.get('/api/profile', requireAuth, (req, res) => {
  db.get(
    'SELECT id, username, email, name, location, profile_photo, availability, is_public FROM users WHERE id = ?',
    [req.session.userId],
    (err, user) => {
      if (err || !user) {
        res.status(404).json({ error: 'User not found' });
        return;
      }
      
      // Get user's skills
      db.all(
        'SELECT * FROM skills WHERE user_id = ?',
        [req.session.userId],
        (err, skills) => {
          user.skills = skills || [];
          res.json(user);
        }
      );
    }
  );
});

app.put('/api/profile', requireAuth, (req, res) => {
  const { name, location, availability, is_public } = req.body;
  
  db.run(
    'UPDATE users SET name = ?, location = ?, availability = ?, is_public = ? WHERE id = ?',
    [name, location, availability, is_public, req.session.userId],
    (err) => {
      if (err) {
        res.status(500).json({ error: 'Profile update failed' });
      } else {
        res.json({ success: true });
      }
    }
  );
});

// Skills routes
app.post('/api/skills', requireAuth, (req, res) => {
  const { skill_name, skill_type, description, level } = req.body;
  
  db.run(
    'INSERT INTO skills (user_id, skill_name, skill_type, description, level) VALUES (?, ?, ?, ?, ?)',
    [req.session.userId, skill_name, skill_type, description, level],
    function(err) {
      if (err) {
        res.status(500).json({ error: 'Failed to add skill' });
      } else {
        res.json({ success: true, skillId: this.lastID });
      }
    }
  );
});

app.delete('/api/skills/:id', requireAuth, (req, res) => {
  db.run(
    'DELETE FROM skills WHERE id = ? AND user_id = ?',
    [req.params.id, req.session.userId],
    (err) => {
      if (err) {
        res.status(500).json({ error: 'Failed to delete skill' });
      } else {
        res.json({ success: true });
      }
    }
  );
});

// Browse users route
app.get('/api/users', requireAuth, (req, res) => {
  const { search } = req.query;
  let query = `
    SELECT DISTINCT u.id, u.username, u.name, u.location, u.availability,
           GROUP_CONCAT(s.skill_name) as skills
    FROM users u
    LEFT JOIN skills s ON u.id = s.user_id AND s.skill_type = 'offered'
    WHERE u.is_public = 1 AND u.id != ? AND u.is_banned = 0
  `;
  
  let params = [req.session.userId];
  
  if (search) {
    query += ' AND s.skill_name LIKE ?';
    params.push(`%${search}%`);
  }
  
  query += ' GROUP BY u.id';
  
  db.all(query, params, (err, users) => {
    if (err) {
      res.status(500).json({ error: 'Failed to fetch users' });
    } else {
      res.json(users);
    }
  });
});

// Swap request routes
app.post('/api/swap-requests', requireAuth, (req, res) => {
  const { requested_id, offered_skill, wanted_skill, message } = req.body;
  
  db.run(
    'INSERT INTO swap_requests (requester_id, requested_id, offered_skill, wanted_skill, message) VALUES (?, ?, ?, ?, ?)',
    [req.session.userId, requested_id, offered_skill, wanted_skill, message],
    function(err) {
      if (err) {
        res.status(500).json({ error: 'Failed to create swap request' });
      } else {
        res.json({ success: true, requestId: this.lastID });
      }
    }
  );
});

app.get('/api/swap-requests', requireAuth, (req, res) => {
  db.all(`
    SELECT sr.*, 
           u1.name as requester_name, u1.username as requester_username,
           u2.name as requested_name, u2.username as requested_username
    FROM swap_requests sr
    JOIN users u1 ON sr.requester_id = u1.id
    JOIN users u2 ON sr.requested_id = u2.id
    WHERE sr.requester_id = ? OR sr.requested_id = ?
    ORDER BY sr.created_at DESC
  `, [req.session.userId, req.session.userId], (err, requests) => {
    if (err) {
      res.status(500).json({ error: 'Failed to fetch swap requests' });
    } else {
      res.json(requests);
    }
  });
});

app.put('/api/swap-requests/:id', requireAuth, (req, res) => {
  const { status } = req.body;
  const validStatuses = ['accepted', 'rejected', 'completed', 'cancelled'];
  
  if (!validStatuses.includes(status)) {
    res.status(400).json({ error: 'Invalid status' });
    return;
  }
  
  db.run(
    'UPDATE swap_requests SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND (requester_id = ? OR requested_id = ?)',
    [status, req.params.id, req.session.userId, req.session.userId],
    (err) => {
      if (err) {
        res.status(500).json({ error: 'Failed to update swap request' });
      } else {
        res.json({ success: true });
      }
    }
  );
});

app.delete('/api/swap-requests/:id', requireAuth, (req, res) => {
  db.run(
    'DELETE FROM swap_requests WHERE id = ? AND requester_id = ? AND status = "pending"',
    [req.params.id, req.session.userId],
    (err) => {
      if (err) {
        res.status(500).json({ error: 'Failed to delete swap request' });
      } else {
        res.json({ success: true });
      }
    }
  );
});

// Rating routes
app.post('/api/ratings', requireAuth, (req, res) => {
  const { swap_id, rated_id, rating, feedback } = req.body;
  
  db.run(
    'INSERT INTO ratings (swap_id, rater_id, rated_id, rating, feedback) VALUES (?, ?, ?, ?, ?)',
    [swap_id, req.session.userId, rated_id, rating, feedback],
    function(err) {
      if (err) {
        res.status(500).json({ error: 'Failed to submit rating' });
      } else {
        res.json({ success: true, ratingId: this.lastID });
      }
    }
  );
});

// Admin routes
app.get('/api/admin/users', requireAdmin, (req, res) => {
  db.all(
    'SELECT id, username, email, name, location, is_public, is_banned, created_at FROM users WHERE is_admin = 0',
    (err, users) => {
      if (err) {
        res.status(500).json({ error: 'Failed to fetch users' });
      } else {
        res.json(users);
      }
    }
  );
});

app.put('/api/admin/users/:id/ban', requireAdmin, (req, res) => {
  const { is_banned } = req.body;
  
  db.run(
    'UPDATE users SET is_banned = ? WHERE id = ?',
    [is_banned, req.params.id],
    (err) => {
      if (err) {
        res.status(500).json({ error: 'Failed to update user status' });
      } else {
        res.json({ success: true });
      }
    }
  );
});

app.get('/api/admin/swaps', requireAdmin, (req, res) => {
  db.all(`
    SELECT sr.*, 
           u1.name as requester_name, u1.username as requester_username,
           u2.name as requested_name, u2.username as requested_username
    FROM swap_requests sr
    JOIN users u1 ON sr.requester_id = u1.id
    JOIN users u2 ON sr.requested_id = u2.id
    ORDER BY sr.created_at DESC
  `, (err, swaps) => {
    if (err) {
      res.status(500).json({ error: 'Failed to fetch swaps' });
    } else {
      res.json(swaps);
    }
  });
});

app.post('/api/admin/messages', requireAdmin, (req, res) => {
  const { title, message } = req.body;
  
  db.run(
    'INSERT INTO admin_messages (title, message) VALUES (?, ?)',
    [title, message],
    function(err) {
      if (err) {
        res.status(500).json({ error: 'Failed to send message' });
      } else {
        res.json({ success: true, messageId: this.lastID });
      }
    }
  );
});

app.get('/api/admin/stats', requireAdmin, (req, res) => {
  db.get(
    'SELECT COUNT(*) as total_users FROM users WHERE is_admin = 0',
    (err, userCount) => {
      if (err) {
        res.status(500).json({ error: 'Failed to fetch stats' });
        return;
      }
      
      db.get(
        'SELECT COUNT(*) as total_swaps FROM swap_requests',
        (err, swapCount) => {
          if (err) {
            res.status(500).json({ error: 'Failed to fetch stats' });
            return;
          }
          
          db.get(
            'SELECT COUNT(*) as total_skills FROM skills',
            (err, skillCount) => {
              if (err) {
                res.status(500).json({ error: 'Failed to fetch stats' });
                return;
              }
              
              res.json({
                totalUsers: userCount.total_users,
                totalSwaps: swapCount.total_swaps,
                totalSkills: skillCount.total_skills
              });
            }
          );
        }
      );
    }
  );
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});