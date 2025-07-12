// Admin Dashboard JavaScript

let adminStats = {};
let allUsers = [];
let allSwaps = [];

// Navigation
function showAdminSection(sectionName) {
    // Hide all sections
    document.querySelectorAll('.content-section').forEach(section => {
        section.classList.remove('active');
    });
    
    // Show selected section
    document.getElementById(`${sectionName}Section`).classList.add('active');
    
    // Update navigation
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
    });
    
    event.target.classList.add('active');
    
    // Load section-specific data
    switch(sectionName) {
        case 'overview':
            loadAdminStats();
            break;
        case 'users':
            loadAllUsers();
            break;
        case 'swaps':
            loadAllSwaps();
            break;
        case 'messages':
            loadRecentMessages();
            break;
    }
}

// Toast notification
function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast ${type}`;
    toast.classList.add('show');
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// Check admin authentication
async function checkAdminAuth() {
    try {
        const response = await fetch('/api/profile');
        if (response.ok) {
            const user = await response.json();
            // This is a simplified check - in production, you'd verify admin status server-side
            return user.email === 'admin@skillswap.com';
        } else {
            window.location.href = '/login.html';
            return false;
        }
    } catch (error) {
        window.location.href = '/login.html';
        return false;
    }
}

// Logout function
async function logout() {
    try {
        await fetch('/api/logout', { method: 'POST' });
        window.location.href = '/login.html';
    } catch (error) {
        window.location.href = '/login.html';
    }
}

// Load admin statistics
async function loadAdminStats() {
    try {
        const response = await fetch('/api/admin/stats');
        if (response.ok) {
            adminStats = await response.json();
            
            document.getElementById('totalUsers').textContent = adminStats.totalUsers;
            document.getElementById('totalSwaps').textContent = adminStats.totalSwaps;
            document.getElementById('totalSkills').textContent = adminStats.totalSkills;
            
            // Calculate active swaps (you might want to add this to the API)
            const swapsResponse = await fetch('/api/admin/swaps');
            if (swapsResponse.ok) {
                const swaps = await swapsResponse.json();
                const activeSwaps = swaps.filter(swap => 
                    ['pending', 'accepted'].includes(swap.status)
                ).length;
                document.getElementById('activeSwaps').textContent = activeSwaps;
            }
        } else {
            showToast('Failed to load admin statistics', 'error');
        }
    } catch (error) {
        showToast('Network error', 'error');
    }
}

// Load all users
async function loadAllUsers() {
    try {
        const response = await fetch('/api/admin/users');
        if (response.ok) {
            allUsers = await response.json();
            displayUsers();
        } else {
            showToast('Failed to load users', 'error');
        }
    } catch (error) {
        showToast('Network error', 'error');
    }
}

// Display users in table
function displayUsers() {
    const tbody = document.getElementById('usersTableBody');
    tbody.innerHTML = '';
    
    allUsers.forEach(user => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${user.username}</td>
            <td>${user.name || 'Not set'}</td>
            <td>${user.email}</td>
            <td>${user.location || 'Not set'}</td>
            <td>
                <span class="status-badge ${user.is_banned ? 'banned' : 'active'}">
                    ${user.is_banned ? 'Banned' : 'Active'}
                </span>
            </td>
            <td>${new Date(user.created_at).toLocaleDateString()}</td>
            <td>
                <button class="btn ${user.is_banned ? 'btn-success' : 'btn-danger'}" 
                        onclick="toggleUserBan(${user.id}, ${!user.is_banned})">
                    ${user.is_banned ? 'Unban' : 'Ban'} User
                </button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

// Toggle user ban status
async function toggleUserBan(userId, shouldBan) {
    const action = shouldBan ? 'ban' : 'unban';
    if (!confirm(`Are you sure you want to ${action} this user?`)) return;
    
    try {
        const response = await fetch(`/api/admin/users/${userId}/ban`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ is_banned: shouldBan })
        });
        
        if (response.ok) {
            showToast(`User ${action}ned successfully!`);
            loadAllUsers(); // Reload to show updated status
        } else {
            showToast(`Failed to ${action} user`, 'error');
        }
    } catch (error) {
        showToast('Network error', 'error');
    }
}

// Load all swaps
async function loadAllSwaps() {
    try {
        const response = await fetch('/api/admin/swaps');
        if (response.ok) {
            allSwaps = await response.json();
            displaySwaps();
        } else {
            showToast('Failed to load swaps', 'error');
        }
    } catch (error) {
        showToast('Network error', 'error');
    }
}

// Display swaps in table
function displaySwaps() {
    const tbody = document.getElementById('swapsTableBody');
    tbody.innerHTML = '';
    
    allSwaps.forEach(swap => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${swap.requester_name} (@${swap.requester_username})</td>
            <td>${swap.requested_name} (@${swap.requested_username})</td>
            <td>${swap.offered_skill}</td>
            <td>${swap.wanted_skill}</td>
            <td>
                <span class="swap-status ${swap.status}">${swap.status}</span>
            </td>
            <td>${new Date(swap.created_at).toLocaleDateString()}</td>
            <td>${new Date(swap.updated_at).toLocaleDateString()}</td>
        `;
        tbody.appendChild(row);
    });
}

// Admin message form submission
document.getElementById('adminMessageForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const messageData = {
        title: document.getElementById('messageTitle').value,
        message: document.getElementById('messageContent').value
    };
    
    try {
        const response = await fetch('/api/admin/messages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(messageData)
        });
        
        if (response.ok) {
            showToast('Platform message sent successfully!');
            document.getElementById('adminMessageForm').reset();
            loadRecentMessages();
        } else {
            showToast('Failed to send message', 'error');
        }
    } catch (error) {
        showToast('Network error', 'error');
    }
});

// Load recent messages (placeholder - would need API endpoint)
function loadRecentMessages() {
    const container = document.getElementById('recentMessages');
    
    // This is a placeholder since we don't have a get messages endpoint
    // In a real app, you'd fetch recent messages from the server
    container.innerHTML = `
        <div class="message-item">
            <h4>Welcome to SkillSwap</h4>
            <p>Platform is now live and ready for skill exchanges!</p>
            <div class="message-date">Today</div>
        </div>
        <div class="message-item">
            <h4>System Maintenance</h4>
            <p>Scheduled maintenance will occur this weekend.</p>
            <div class="message-date">Yesterday</div>
        </div>
    `;
}

// Initialize admin dashboard
document.addEventListener('DOMContentLoaded', async () => {
    const isAdmin = await checkAdminAuth();
    if (isAdmin) {
        loadAdminStats();
    }
});