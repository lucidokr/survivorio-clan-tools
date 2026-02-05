/**
 * API Service
 * Handles all API calls with authentication
 */

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

/**
 * Get auth headers with Bearer token
 */
const getAuthHeaders = () => {
    const token = localStorage.getItem('authToken');
    return {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` })
    };
};

/**
 * Get auth headers for multipart form data
 */
const getAuthHeadersForFormData = () => {
    const token = localStorage.getItem('authToken');
    return {
        ...(token && { 'Authorization': `Bearer ${token}` })
    };
};

/**
 * Handle API response
 */
const handleResponse = async (response) => {
    if (response.status === 401) {
        // Token expired or invalid - redirect to login
        localStorage.removeItem('authToken');
        window.location.href = '/login';
        throw new Error('Session expired. Please login again.');
    }

    if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(error.error || error.message || 'API request failed');
    }

    return response.json();
};

// ============== AUTH API ==============

export const authAPI = {
    async getMe() {
        const response = await fetch(`${API_URL}/api/auth/me`, {
            headers: getAuthHeaders()
        });
        return handleResponse(response);
    },

    async sync() {
        const response = await fetch(`${API_URL}/api/auth/sync`, {
            method: 'POST',
            headers: getAuthHeaders()
        });
        return handleResponse(response);
    }
};

// ============== CLAN API ==============

export const clanAPI = {
    async getMyClans() {
        const response = await fetch(`${API_URL}/api/clan/my-clans`, {
            headers: getAuthHeaders()
        });
        return handleResponse(response);
    },

    async getAll() {
        const response = await fetch(`${API_URL}/api/clan`, {
            headers: getAuthHeaders()
        });
        return handleResponse(response);
    },

    async getAllAdmin(activeOnly = true) {
        const response = await fetch(`${API_URL}/api/clan/all?activeOnly=${activeOnly}`, {
            headers: getAuthHeaders()
        });
        return handleResponse(response);
    },

    async getById(id) {
        const response = await fetch(`${API_URL}/api/clan/${id}`, {
            headers: getAuthHeaders()
        });
        return handleResponse(response);
    },

    async register(formData) {
        const response = await fetch(`${API_URL}/api/clan/register`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(formData)
        });
        return handleResponse(response);
    },

    async delete(id) {
        const response = await fetch(`${API_URL}/api/clan/${id}`, {
            method: 'DELETE',
            headers: getAuthHeaders()
        });
        return handleResponse(response);
    },

    async update(id, data) {
        const response = await fetch(`${API_URL}/api/clan/${id}`, {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify(data)
        });
        return handleResponse(response);
    },

};

// ============== COMMUNITY API ==============

export const communityAPI = {
    async create(data) {
        const response = await fetch(`${API_URL}/api/community`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(data)
        });
        return handleResponse(response);
    },

    async getAll() {
        const response = await fetch(`${API_URL}/api/community`, {
            headers: getAuthHeaders()
        });
        return handleResponse(response);
    },

    async getById(id) {
        const response = await fetch(`${API_URL}/api/community/${id}`, {
            headers: getAuthHeaders()
        });
        return handleResponse(response);
    },

    async update(id, data) {
        const response = await fetch(`${API_URL}/api/community/${id}`, {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify(data)
        });
        return handleResponse(response);
    },

    async delete(id) {
        const response = await fetch(`${API_URL}/api/community/${id}`, {
            method: 'DELETE',
            headers: getAuthHeaders()
        });
        return handleResponse(response);
    },

    async addClan(id, clanId) {
        const response = await fetch(`${API_URL}/api/community/${id}/add-clan`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ clanId })
        });
        return handleResponse(response);
    },

    async removeClan(id, clanId) {
        const response = await fetch(`${API_URL}/api/community/${id}/remove-clan`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ clanId })
        });
        return handleResponse(response);
    },

    async stats(id, weeks = 12) {
        const response = await fetch(`${API_URL}/api/community/${id}/stats?weeks=${weeks}`, {
            headers: getAuthHeaders()
        });
        return handleResponse(response);
    }
};

// ============== MEMBERS API ==============

export const membersAPI = {
    async getByClan(clanId) {
        const response = await fetch(`${API_URL}/api/members/clan/${clanId}`, {
            headers: getAuthHeaders()
        });
        return handleResponse(response);
    },

    async getById(id) {
        const response = await fetch(`${API_URL}/api/members/${id}`, {
            headers: getAuthHeaders()
        });
        return handleResponse(response);
    },

    async create(memberData) {
        const response = await fetch(`${API_URL}/api/members`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(memberData)
        });
        return handleResponse(response);
    },

    async update(id, memberData) {
        const response = await fetch(`${API_URL}/api/members/${id}`, {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify(memberData)
        });
        return handleResponse(response);
    },

    async delete(id) {
        const response = await fetch(`${API_URL}/api/members/${id}`, {
            method: 'DELETE',
            headers: getAuthHeaders()
        });
        return handleResponse(response);
    },

    async bulkUpdate(clanId, members) {
        const response = await fetch(`${API_URL}/api/members/bulk`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ clanId, members })
        });
        return handleResponse(response);
    }
};

// ============== MEMBERS IMPORT API ==============

export const membersImportAPI = {
    async preview(formData) {
        const response = await fetch(`${API_URL}/api/members-import/preview`, {
            method: 'POST',
            headers: getAuthHeadersForFormData(),
            body: formData
        });
        return handleResponse(response);
    },

    async import(clanId, members) {
        const response = await fetch(`${API_URL}/api/members-import/import`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ clanId, members })
        });
        return handleResponse(response);
    }
};

// ============== RESULTS API ==============

export const resultsAPI = {
    async getAll(params = {}) {
        const queryString = new URLSearchParams(params).toString();
        const response = await fetch(`${API_URL}/api/results?${queryString}`, {
            headers: getAuthHeaders()
        });
        return handleResponse(response);
    },

    async getByClanAndWeek(clanId, week) {
        const response = await fetch(`${API_URL}/api/results/clan/${clanId}/week/${week}`, {
            headers: getAuthHeaders()
        });
        return handleResponse(response);
    },

    async getStatistics(clanId, weeks = 12) {
        const response = await fetch(`${API_URL}/api/results/statistics/${clanId}?weeks=${weeks}`, {
            headers: getAuthHeaders()
        });
        return handleResponse(response);
    },

    async compare(clanId, week) {
        const response = await fetch(`${API_URL}/api/results/compare?clanId=${clanId}&week=${week}`, {
            headers: getAuthHeaders()
        });
        return handleResponse(response);
    },

    async extract(formData) {
        const response = await fetch(`${API_URL}/api/results/extract`, {
            method: 'POST',
            headers: getAuthHeadersForFormData(),
            body: formData
        });
        return handleResponse(response);
    },

    async bulkSave(data) {
        const response = await fetch(`${API_URL}/api/results/bulk`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(data)
        });
        return handleResponse(response);
    },

    async upload(formData) {
        const response = await fetch(`${API_URL}/api/results/upload`, {
            method: 'POST',
            headers: getAuthHeadersForFormData(),
            body: formData
        });
        return handleResponse(response);
    },

    async addManual(data) {
        const response = await fetch(`${API_URL}/api/results/manual`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(data)
        });
        return handleResponse(response);
    }
};

export default {
    auth: authAPI,
    clan: clanAPI,
    community: communityAPI,
    members: membersAPI,
    membersImport: membersImportAPI,
    results: resultsAPI
};
