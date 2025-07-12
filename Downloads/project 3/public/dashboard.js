// Dashboard JavaScript

let currentUser = null;
let currentUsers = [];
let currentSwaps = [];
let userSkills = [];

// Navigation
function showSection(sectionName) {
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
        case 'profile':
            loadProfile();
            break;
        case 'browse':
            loadUsers();
            break;
        case 'swaps':
            loadSwaps();
            break;
        case 'dashboard':
            loadDashboardStats();
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

// Check authentication and load user data
async function checkAuth() {
    try {
        const response = await fetch('/api/profile');
        if (response.ok) {
            currentUser = await response.json();
            return true;
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

// Load dashboard statistics
async function loadDashboardStats() {
    if (!currentUser) return;
    
    const offeredSkills = currentUser.skills.filter(skill => skill.skill_type === 'offered').length;
    const wantedSkills = currentUser.skills.filter(skill => skill.skill_type === 'wanted').length;
    
    try {
        const response = await fetch('/api/swap-requests');
        if (response.ok) {
            const swaps = await response.json();
            const activeSwaps = swaps.filter(swap => ['pending', 'accepted'].includes(swap.status)).length;
            
            document.getElementById('mySkillsCount').textContent = offeredSkills;
            document.getElementById('wantedSkillsCount').textContent = wantedSkills;
            document.getElementById('activeSwapsCount').textContent = activeSwaps;
        }
    } catch (error) {
        console.error('Error loading dashboard stats:', error);
    }
}

// Load and display profile
async function loadProfile() {
    if (!currentUser) return;
    
    // Populate form fields
    document.getElementById('profileName').value = currentUser.name || '';
    document.getElementById('profileLocation').value = currentUser.location || '';
    document.getElementById('profileAvailability').value = currentUser.availability || '';
    document.getElementById('profilePublic').checked = currentUser.is_public;
    
    // Display skills
    displaySkills();
}

// Display skills
function displaySkills() {
    const offeredSkillsContainer = document.getElementById('offeredSkills');
    const wantedSkillsContainer = document.getElementById('wantedSkills');
    
    offeredSkillsContainer.innerHTML = '';
    wantedSkillsContainer.innerHTML = '';
    
    currentUser.skills.forEach(skill => {
        const skillCard = createSkillCard(skill);
        
        if (skill.skill_type === 'offered') {
            offeredSkillsContainer.appendChild(skillCard);
        } else {
            wantedSkillsContainer.appendChild(skillCard);
        }
    });
}

// Create skill card element
function createSkillCard(skill) {
    const card = document.createElement('div');
    card.className = 'skill-card';
    
    card.innerHTML = `
        <div class="skill-info">
            <h5>${skill.skill_name}</h5>
            <div class="skill-level">${skill.level}</div>
            ${skill.description ? `<div class="skill-description">${skill.description}</div>` : ''}
        </div>
        <div class="skill-actions">
            <button onclick="deleteSkill(${skill.id})" title="Delete skill">🗑️</button>
        </div>
    `;
    
    return card;
}

// Profile form submission
document.getElementById('profileForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const formData = {
        name: document.getElementById('profileName').value,
        location: document.getElementById('profileLocation').value,
        availability: document.getElementById('profileAvailability').value,
        is_public: document.getElementById('profilePublic').checked
    };
    
    try {
        const response = await fetch('/api/profile', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formData)
        });
        
        if (response.ok) {
            showToast('Profile updated successfully!');
            // Update current user data
            Object.assign(currentUser, formData);
        } else {
            showToast('Failed to update profile', 'error');
        }
    } catch (error) {
        showToast('Network error', 'error');
    }
});

// Add skill form submission
document.getElementById('addSkillForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const skillData = {
        skill_name: document.getElementById('skillName').value,
        skill_type: document.getElementById('skillType').value,
        level: document.getElementById('skillLevel').value,
        description: document.getElementById('skillDescription').value
    };
    
    try {
        const response = await fetch('/api/skills', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(skillData)
        });
        
        if (response.ok) {
            showToast('Skill added successfully!');
            // Reset form
            document.getElementById('addSkillForm').reset();
            // Reload profile to show new skill
            const profileResponse = await fetch('/api/profile');
            if (profileResponse.ok) {
                currentUser = await profileResponse.json();
                displaySkills();
            }
        } else {
            showToast('Failed to add skill', 'error');
        }
    } catch (error) {
        showToast('Network error', 'error');
    }
});

// Delete skill
async function deleteSkill(skillId) {
    if (!confirm('Are you sure you want to delete this skill?')) return;
    
    try {
        const response = await fetch(`/api/skills/${skillId}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            showToast('Skill deleted successfully!');
            // Remove skill from current user data
            currentUser.skills = currentUser.skills.filter(skill => skill.id !== skillId);
            displaySkills();
        } else {
            showToast('Failed to delete skill', 'error');
        }
    } catch (error) {
        showToast('Network error', 'error');
    }
}

// Load users for browsing
async function loadUsers(search = '') {
    try {
        const url = search ? `/api/users?search=${encodeURIComponent(search)}` : '/api/users';
        const response = await fetch(url);
        
        if (response.ok) {
            currentUsers = await response.json();
            displayUsers();
        } else {
            showToast('Failed to load users', 'error');
        }
    } catch (error) {
        showToast('Network error', 'error');
    }
}

// Display users
function displayUsers() {
    const container = document.getElementById('usersList');
    container.innerHTML = '';
    
    if (currentUsers.length === 0) {
        container.innerHTML = '<div class="text-center"><p>No users found matching your search.</p></div>';
        return;
    }
    
    currentUsers.forEach(user => {
        const userCard = createUserCard(user);
        container.appendChild(userCard);
    });
}

// Create user card element
function createUserCard(user) {
    const card = document.createElement('div');
    card.className = 'user-card';
    
    const skills = user.skills ? user.skills.split(',').filter(skill => skill) : [];
    const skillTags = skills.map(skill => `<span class="skill-tag">${skill}</span>`).join('');
    
    card.innerHTML = `
        <div class="user-header">
            <h3>${user.name}</h3>
            <div class="username">@${user.username}</div>
        </div>
        ${user.location ? `<div class="user-location">📍 ${user.location}</div>` : ''}
        ${user.availability ? `<div class="user-availability">🕒 ${user.availability}</div>` : ''}
        <div class="user-skills">
            <h4>Skills Offered:</h4>
            <div class="skills-tags">
                ${skillTags || '<span class="skill-tag">No skills listed</span>'}
            </div>
        </div>
        <button class="btn btn-primary" onclick="openSwapModal(${user.id}, '${user.name}')">
            Request Skill Swap
        </button>
    `;
    
    return card;
}

// Search functionality
function searchUsers() {
    const searchTerm = document.getElementById('searchSkills').value;
    loadUsers(searchTerm);
}

// Enter key search
document.getElementById('searchSkills').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        searchUsers();
    }
});

// Swap request modal
function openSwapModal(userId, userName) {
    // Populate offered skills dropdown
    const offeredSkillsSelect = document.getElementById('swapOfferedSkill');
    offeredSkillsSelect.innerHTML = '<option value="">Select your skill to offer</option>';
    
    const offeredSkills = currentUser.skills.filter(skill => skill.skill_type === 'offered');
    offeredSkills.forEach(skill => {
        const option = document.createElement('option');
        option.value = skill.skill_name;
        option.textContent = `${skill.skill_name} (${skill.level})`;
        offeredSkillsSelect.appendChild(option);
    });
    
    document.getElementById('swapRequestedId').value = userId;
    document.getElementById('swapWantedSkill').value = ''; // Let user type what they want
    document.getElementById('swapWantedSkill').placeholder = `What skill do you want from ${userName}?`;
    document.getElementById('swapWantedSkill').readOnly = false;
    document.getElementById('swapMessage').value = '';
    
    document.getElementById('swapModal').classList.add('active');
}

function closeSwapModal() {
    document.getElementById('swapModal').classList.remove('active');
}

// Swap request form submission
document.getElementById('swapRequestForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const swapData = {
        requested_id: parseInt(document.getElementById('swapRequestedId').value),
        offered_skill: document.getElementById('swapOfferedSkill').value,
        wanted_skill: document.getElementById('swapWantedSkill').value,
        message: document.getElementById('swapMessage').value
    };
    
    try {
        const response = await fetch('/api/swap-requests', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(swapData)
        });
        
        if (response.ok) {
            showToast('Swap request sent successfully!');
            closeSwapModal();
        } else {
            showToast('Failed to send swap request', 'error');
        }
    } catch (error) {
        showToast('Network error', 'error');
    }
});

// Load swap requests
async function loadSwaps() {
    try {
        const response = await fetch('/api/swap-requests');
        if (response.ok) {
            currentSwaps = await response.json();
            displaySwaps('all');
        } else {
            showToast('Failed to load swaps', 'error');
        }
    } catch (error) {
        showToast('Network error', 'error');
    }
}

// Display swaps with filtering
function displaySwaps(filter) {
    const container = document.getElementById('swapsList');
    container.innerHTML = '';
    
    // Update tab active state
    document.querySelectorAll('.swaps-tabs .tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.classList.add('active');
    
    let filteredSwaps = currentSwaps;
    if (filter !== 'all') {
        filteredSwaps = currentSwaps.filter(swap => swap.status === filter);
    }
    
    if (filteredSwaps.length === 0) {
        container.innerHTML = '<div class="text-center"><p>No swaps found for this filter.</p></div>';
        return;
    }
    
    filteredSwaps.forEach(swap => {
        const swapCard = createSwapCard(swap);
        container.appendChild(swapCard);
    });
}

// Show swaps with filter
function showSwaps(filter) {
    displaySwaps(filter);
}

// Create swap card element
function createSwapCard(swap) {
    const card = document.createElement('div');
    card.className = 'swap-card';
    
    const isRequester = swap.requester_id === currentUser.id;
    const otherUser = isRequester ? swap.requested_name : swap.requester_name;
    const otherUsername = isRequester ? swap.requested_username : swap.requester_username;
    
    let actions = '';
    
    if (swap.status === 'pending') {
        if (isRequester) {
            actions = `
                <button class="btn btn-outline" onclick="cancelSwapRequest(${swap.id})">Cancel Request</button>
            `;
        } else {
            actions = `
                <button class="btn btn-success" onclick="respondToSwap(${swap.id}, 'accepted')">Accept</button>
                <button class="btn btn-danger" onclick="respondToSwap(${swap.id}, 'rejected')">Reject</button>
            `;
        }
    } else if (swap.status === 'accepted') {
        actions = `
            <button class="btn btn-primary" onclick="completeSwap(${swap.id})">Mark as Completed</button>
        `;
    } else if (swap.status === 'completed' && !swap.rated) {
        const otherUserId = isRequester ? swap.requested_id : swap.requester_id;
        actions = `
            <button class="btn btn-secondary" onclick="openRatingModal(${swap.id}, ${otherUserId}, '${otherUser}')">Rate Swap</button>
        `;
    }
    
    card.innerHTML = `
        <div class="swap-header">
            <h3>${isRequester ? 'Request to' : 'Request from'} ${otherUser} (@${otherUsername})</h3>
            <span class="swap-status ${swap.status}">${swap.status}</span>
        </div>
        <div class="swap-content">
            <div class="swap-skills">
                <div class="skill-box">
                    <h4>Offering</h4>
                    <p>${swap.offered_skill}</p>
                </div>
                <div class="swap-arrow">⇄</div>
                <div class="skill-box">
                    <h4>Wanting</h4>
                    <p>${swap.wanted_skill}</p>
                </div>
            </div>
            ${swap.message ? `<div class="swap-message">"${swap.message}"</div>` : ''}
            <div class="swap-meta">
                <small>Created: ${new Date(swap.created_at).toLocaleDateString()}</small>
                ${swap.updated_at !== swap.created_at ? 
                    `<small>Updated: ${new Date(swap.updated_at).toLocaleDateString()}</small>` : ''}
            </div>
        </div>
        ${actions ? `<div class="swap-actions">${actions}</div>` : ''}
    `;
    
    return card;
}

// Respond to swap request
async function respondToSwap(swapId, status) {
    try {
        const response = await fetch(`/api/swap-requests/${swapId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status })
        });
        
        if (response.ok) {
            showToast(`Swap request ${status}!`);
            loadSwaps();
        } else {
            showToast('Failed to update swap request', 'error');
        }
    } catch (error) {
        showToast('Network error', 'error');
    }
}

// Cancel swap request
async function cancelSwapRequest(swapId) {
    if (!confirm('Are you sure you want to cancel this swap request?')) return;
    
    try {
        const response = await fetch(`/api/swap-requests/${swapId}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            showToast('Swap request cancelled!');
            loadSwaps();
        } else {
            showToast('Failed to cancel swap request', 'error');
        }
    } catch (error) {
        showToast('Network error', 'error');
    }
}

// Complete swap
async function completeSwap(swapId) {
    if (!confirm('Mark this swap as completed?')) return;
    
    await respondToSwap(swapId, 'completed');
}

// Rating modal
function openRatingModal(swapId, ratedUserId, ratedUserName) {
    document.getElementById('ratingSwapId').value = swapId;
    document.getElementById('ratingRatedId').value = ratedUserId;
    document.querySelector('#ratingModal h3').textContent = `Rate Swap with ${ratedUserName}`;
    
    // Reset rating stars
    document.querySelectorAll('.star').forEach(star => {
        star.classList.remove('active');
    });
    document.getElementById('ratingValue').value = '';
    document.getElementById('ratingFeedback').value = '';
    
    document.getElementById('ratingModal').classList.add('active');
}

function closeRatingModal() {
    document.getElementById('ratingModal').classList.remove('active');
}

// Rating stars interaction
document.querySelectorAll('.star').forEach(star => {
    star.addEventListener('click', () => {
        const rating = parseInt(star.dataset.rating);
        document.getElementById('ratingValue').value = rating;
        
        // Update star display
        document.querySelectorAll('.star').forEach((s, index) => {
            if (index < rating) {
                s.classList.add('active');
            } else {
                s.classList.remove('active');
            }
        });
    });
});

// Rating form submission
document.getElementById('ratingForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const ratingData = {
        swap_id: parseInt(document.getElementById('ratingSwapId').value),
        rated_id: parseInt(document.getElementById('ratingRatedId').value),
        rating: parseInt(document.getElementById('ratingValue').value),
        feedback: document.getElementById('ratingFeedback').value
    };
    
    try {
        const response = await fetch('/api/ratings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(ratingData)
        });
        
        if (response.ok) {
            showToast('Rating submitted successfully!');
            closeRatingModal();
            loadSwaps();
        } else {
            showToast('Failed to submit rating', 'error');
        }
    } catch (error) {
        showToast('Network error', 'error');
    }
});

// Initialize dashboard
document.addEventListener('DOMContentLoaded', async () => {
    const authenticated = await checkAuth();
    if (authenticated) {
        loadDashboardStats();
    }
});