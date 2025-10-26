document.addEventListener('DOMContentLoaded', function() {
    let healthChart = null;
    let distributionChart = null;

    // Treatment recommendations
    const treatmentRecommendations = {
        'healthy': 'No treatment needed.',
        'suspected bird flu': 'Immediate isolation required. Contact veterinarian urgently. Follow biosecurity protocols.'
    };

    // Helper: normalize any incoming status string
    function normalizeStatus(status) {
        if (!status) return null;
        const s = String(status).trim().toLowerCase();
        if (s.includes('healthy')) return 'healthy';
        if (s.includes('suspected bird flu') || s.includes('bird flu')) return 'suspected_bird_flu';
        if (s.includes('fever detected')) return 'fever_detected';
        if (s.includes('invalid image')) return 'invalid_image';
        return null;
    }

    // Helper: get element safely
    function $id(id) {
        return document.getElementById(id);
    }

    // Restore sidebar collapsed state (if previously set)
    function restoreSidebarState() {
        const sidebar = $id('sidebar');
        const savedState = localStorage.getItem('sidebarCollapsed');
        if (savedState === 'true' && sidebar) {
            sidebar.classList.add('collapsed');
        }
    }

    // Initialization sequence
    restoreSidebarState();
    initializeDashboard();
    setupEventListeners();

    // Auto-refresh dashboard data every 60 seconds
    setInterval(() => {
        initializeDashboard();
    }, 60000);

    // Main entry: load analyses and update UI
    function initializeDashboard() {
        // Fetch data from Flask API
        fetch('/api/dashboard')
            .then(response => response.json())
            .then(data => {
                updateStatisticsFromAPI(data);
                updateChartsFromAPI(data);
                updateRecentAlertsFromAPI(data);
            })
            .catch(error => {
                console.error('Error fetching dashboard data:', error);
                showEmptyState();
            });
    }

    // Load analyses from localStorage (fallback)
    function getAnalyses() {
        try {
            const data = localStorage.getItem('analyses');
            return data ? JSON.parse(data) : [];
        } catch (error) {
            console.error('Error loading analyses:', error);
            // Reset localStorage if invalid JSON
            localStorage.removeItem('analyses');
            return [];
        }
    }

    // Update statistics from API data
    function updateStatisticsFromAPI(data) {
        const stats = data.stats || { total: 0, healthy: 0, sick: 0 };

        // Elements
        const totalEl = $id('totalCount');
        const healthyEl = $id('healthyCount');
        const birdFluEl = $id('birdFluCount');

        if (totalEl) totalEl.textContent = stats.total;
        if (healthyEl) healthyEl.textContent = stats.healthy;
        if (birdFluEl) birdFluEl.textContent = stats.sick;

        // Update progress bars
        const healthyProgress = $id('healthyProgress');
        const birdFluProgress = $id('birdFluProgress');

        if (stats.total > 0) {
            const healthyPct = (stats.healthy / stats.total) * 100;
            const sickPct = (stats.sick / stats.total) * 100;

            if (healthyProgress) healthyProgress.style.width = `${healthyPct}%`;
            if (birdFluProgress) birdFluProgress.style.width = `${sickPct}%`;
        } else {
            if (healthyProgress) healthyProgress.style.width = '0%';
            if (birdFluProgress) birdFluProgress.style.width = '0%';
        }
    }

    // Update charts from API data
    function updateChartsFromAPI(data) {
        updateHealthChartFromAPI(data);
        updateDistributionChartFromAPI(data);
    }

    // Health trend chart from API
    function updateHealthChartFromAPI(data) {
        const ctx = $id('healthChart');
        if (!ctx) return;

        try {
            if (healthChart && typeof healthChart.destroy === 'function') {
                healthChart.destroy();
            }
        } catch (e) {
            console.error('Error destroying healthChart:', e);
        }

        const chartData = data.health_trend || { labels: [], healthy: [], sick: [] };

        try {
            healthChart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: chartData.labels,
                    datasets: [
                        {
                            label: 'Healthy',
                            data: chartData.healthy,
                            borderColor: '#10B981',
                            backgroundColor: 'rgba(16,185,129,0.12)',
                            tension: 0.4,
                            fill: true
                        },
                        {
                            label: 'Suspected Sick',
                            data: chartData.sick,
                            borderColor: '#F59E0B',
                            backgroundColor: 'rgba(245,158,11,0.12)',
                            tension: 0.4,
                            fill: true
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { position: 'top', align: 'end' },
                        tooltip: { mode: 'index', intersect: false }
                    },
                    scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } },
                    interaction: { intersect: false, mode: 'index' }
                }
            });
        } catch (e) {
            console.error('Error creating healthChart:', e);
        }
    }

    // Distribution doughnut chart from API
    function updateDistributionChartFromAPI(data) {
        const ctx = $id('distributionChart');
        if (!ctx) return;

        try {
            if (distributionChart && typeof distributionChart.destroy === 'function') {
                distributionChart.destroy();
            }
        } catch (e) {
            console.error('Error destroying distributionChart:', e);
        }

        const stats = data.stats || { healthy: 0, sick: 0 };

        try {
            distributionChart = new Chart(ctx, {
                type: 'doughnut',
                data: {
                    labels: ['Healthy', 'Suspected Bird Flu'],
                    datasets: [{
                        data: [stats.healthy, stats.sick],
                        backgroundColor: ['#10B981', '#EF4444'],
                        borderWidth: 0
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { position: 'bottom' } },
                    cutout: '70%'
                }
            });
        } catch (e) {
            console.error('Error creating distributionChart:', e);
        }
    }

    // Recent alerts from API
    function updateRecentAlertsFromAPI(data) {
        const alertsTable = $id('alertsTable');
        if (!alertsTable) return;

        const alerts = data.recent_alerts || [];

        if (alerts.length === 0) {
            alertsTable.innerHTML = `
                <tr>
                    <td colspan="4" class="text-center py-4">
                        <i class="bi bi-check-circle-fill text-success fs-4 d-block mb-2"></i>
                        <p class="mb-0">No alerts at this time</p>
                    </td>
                </tr>`;
            return;
        }

        alertsTable.innerHTML = alerts.map(alert => {
            const norm = normalizeStatus(alert.status);
            return `
            <tr>
                <td>${new Date(alert.date).toLocaleDateString()}</td>
                <td>${alert.chicken_id || 'Unknown'}</td>
                <td>
                <span class="status-badge ${getStatusClass(norm)}"></span>
                </td>
                <td>
                    <button class="btn btn-primary btn-sm" onclick="showDetails('${alert.id || ''}')">View Details</button>
                </td>
            </tr>`;
        }).join('');
    }

    // Empty state UI
    function showEmptyState() {
        const idsToZero = ['totalCount', 'healthyCount', 'birdFluCount'];
        idsToZero.forEach(id => {
            const el = $id(id);
            if (el) el.textContent = '0';
        });

        // Reset progress bars
        const healthyProgress = $id('healthyProgress');
        const birdFluProgress = $id('birdFluProgress');

        if (healthyProgress) healthyProgress.style.width = '0%';
        if (birdFluProgress) birdFluProgress.style.width = '0%';

        // Alerts empty state
        const alertsTable = $id('alertsTable');
        if (alertsTable) {
            alertsTable.innerHTML = `
                <tr>
                    <td colspan="4" class="text-center py-4">
                        <i class="bi bi-inbox fs-4 d-block mb-2 text-muted"></i>
                        <p class="mb-0">No data available</p>
                        <p class="text-muted">Start by analyzing some chickens</p>
                    </td>
                </tr>`;
        }

        // Clear charts
        try {
            if (healthChart && typeof healthChart.destroy === 'function') {
                healthChart.destroy();
                healthChart = null;
            }
        } catch (e) {
            console.error('Error destroying healthChart:', e);
        }

        try {
            if (distributionChart && typeof distributionChart.destroy === 'function') {
                distributionChart.destroy();
                distributionChart = null;
            }
        } catch (e) {
            console.error('Error destroying distributionChart:', e);
        }
    }

    // Delete one alert by id
    window.deleteAlert = function(id) {
        if (!id) return;
        let analyses = getAnalyses();
        analyses = analyses.filter(a => a.id !== id);
        localStorage.setItem('analyses', JSON.stringify(analyses));
        initializeDashboard();
    };

    // Wire up listeners and global functions
    function setupEventListeners() {
        // Listen for analysis updates from analysis page
        document.addEventListener('analysisUpdated', function() {
            initializeDashboard();
        });

        // Global showDetails for modal or other UI
        window.showDetails = function(id) {
            const analyses = getAnalyses();
            const analysis = analyses.find(a => a.id === id);
            if (analysis) {
                // If you have a modal implementation, show it. Placeholder example:
                if (typeof DetailsModal === 'function') {
                    const modal = new DetailsModal();
                    modal.show(analysis);
                } else {
                    // Fallback: simple alert (replace with your modal)
                    alert(`Chicken ID: ${analysis.chickenId || 'Unknown'}\nStatus: ${normalizeStatus(analysis.status)}\nDate: ${analysis.date}`);
                }
            }
        };

        // Initialize sidebar listeners
        initSidebar();
    }

    // Sidebar init logic
    function initSidebar() {
        const toggleBtn = $id('sidebarToggle');
        const sidebar = $id('sidebar');
        const menuLinks = document.querySelectorAll('.sidebar-menu a');
        const currentPage = window.location.pathname.split('/').pop();

        // Highlight active link
        menuLinks.forEach(link => {
            const linkPage = link.getAttribute('href').split('/').pop();
            if (linkPage === currentPage) link.classList.add('active');
        });

        if (toggleBtn && sidebar) {
            toggleBtn.addEventListener('click', () => {
                sidebar.classList.toggle('collapsed');
                localStorage.setItem('sidebarCollapsed', sidebar.classList.contains('collapsed'));
            });
        }

        // Load saved collapsed state already handled by restoreSidebarState
        // Prevent sidebar from expanding when collapsed
        menuLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                if (sidebar && sidebar.classList.contains('collapsed')) e.stopPropagation();
            });
        });

        if (sidebar) {
            sidebar.addEventListener('click', function(e) {
                if (sidebar.classList.contains('collapsed') && e.target.closest('.sidebar-menu li a')) {
                    e.stopPropagation();
                }
            });
        }
    }



    // Status class mapping (used for badges)
    function getStatusClass(status) {
        const norm = normalizeStatus(status);
        switch(norm) {
            case 'healthy': return 'status-healthy';
            case 'suspected_bird_flu': return 'status-suspected-bird-flu';
            case 'fever_detected': return 'status-fever-detected';
            case 'invalid_image': return 'status-invalid-image';
            default: return 'status-secondary';
        }
    }

    // Expose normalizeStatus in case other scripts want it
    window.normalizeStatus = normalizeStatus;
});
