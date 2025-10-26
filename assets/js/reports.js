document.addEventListener('DOMContentLoaded', function() {
    // DOM elements
    const reportsTable = document.getElementById('reportsTable');
    const loadingSpinner = document.getElementById('loadingSpinner');
    const totalCount = document.getElementById('totalCount');
    const healthyCount = document.getElementById('healthyCount');
    const birdfluCount = document.getElementById('birdfluCount');
    const distributionChartEl = document.getElementById('distributionChart');
    const weeklyChartEl = document.getElementById('weeklyChart');
    const filterSelect = document.getElementById('filterSelect');
    const paginationControls = document.getElementById('paginationControls');

    // Pagination variables
    let currentPage = 1;
    const itemsPerPage = 10;
    let filteredAnalyses = [];

    function getAnalyses() {
        // Fetch from API instead of localStorage
        return fetch('/api/get_analyses')
            .then(response => response.json())
            .then(data => data.analyses || [])
            .catch(error => {
                console.error('Error fetching analyses:', error);
                return [];
            });
    }

    function updateCounts(analyses) {
        if (!totalCount || !healthyCount || !birdfluCount) return;

        // Filter out 'detection failed' analyses
        const validAnalyses = analyses.filter(a => a.status.toLowerCase() !== 'detection failed');

        totalCount.textContent = validAnalyses.length;
        healthyCount.textContent = validAnalyses.filter(a => a.status.toLowerCase() === 'healthy').length;
        birdfluCount.textContent = validAnalyses.filter(a => a.status.toLowerCase() === 'suspected bird flu').length;
    }

    function updateReportTable(analyses) {
        if (!reportsTable) return;

        // Treatment recommendations based on health status
        const treatmentRecommendations = {
            'healthy': 'No treatment needed.',
            'suspected bird flu': 'Immediate isolation required. Contact veterinarian urgently. Follow biosecurity protocols.',
            'detection failed': 'Unable to analyze. Please ensure clear thermal image and try again.'
        };

        reportsTable.innerHTML = analyses.map(analysis => `
            <tr>
                <td>
                    <div class="d-flex gap-2">
                        <img src="${analysis.image}" alt="Chicken Image" class="analysis-image" title="Analyzed Image">
                         ${analysis.heatPattern ? `<img src="${analysis.heatPattern}" alt="Heat Pattern" class="analysis-image" title="Heat Pattern">` : ''}
                </td>
                <td>
                    <div>Chicken ID: ${analysis.chickenId || 'Unknown'}</div>
                    <div>Date: ${new Date(analysis.date).toLocaleString()}</div>
                </td>
                <td>
                    <span class="status-badge status-${analysis.status.toLowerCase().replace(/\s+/g, '-')}"></span>
                </td>
                <td>${treatmentRecommendations[analysis.status.toLowerCase()] || 'No recommendation'}</td>
                <td>
                    <div style="display: flex; gap: 8px;">
                        <button class="btn btn-sm btn-outline-primary" style="flex: 1;" onclick="viewDetails('${analysis.id}')">
                            <i class="fas fa-eye"></i> View
                        </button>
                        <button class="btn btn-sm btn-outline-danger" style="flex: 1;" onclick="deleteReport('${analysis.id}')">
                            <i class="fas fa-trash"></i> Delete
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');
    }

    function initializeCharts(analyses) {
        if (!distributionChartEl || !weeklyChartEl) return;

        if (window.distributionChart && typeof window.distributionChart.destroy === 'function') {
            window.distributionChart.destroy();
        }
        if (window.weeklyChart && typeof window.weeklyChart.destroy === 'function') {
            window.weeklyChart.destroy();
        }

        // Filter out 'detection failed' analyses
        const validAnalyses = analyses.filter(a => a.status.toLowerCase() !== 'detection failed');

        // Status distribution chart
        const statusCounts = {
            healthy: validAnalyses.filter(a => a.status.toLowerCase() === 'healthy').length,
            birdFlu: validAnalyses.filter(a => a.status.toLowerCase() === 'suspected bird flu').length
        };

        window.distributionChart = new Chart(distributionChartEl, {
            type: 'doughnut',
            data: {
                labels: ['Healthy', 'Suspected Bird Flu'],
                datasets: [{
                    data: [statusCounts.healthy, statusCounts.birdFlu],
                    backgroundColor: [
                        '#10B981',
                        '#EF4444'
                    ],
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false
            }
        });

        // Weekly analysis chart
        const weeklyData = getWeeklyData(validAnalyses);
        window.weeklyChart = new Chart(weeklyChartEl, {
            type: 'line',
            data: {
                labels: weeklyData.labels,
                datasets: [
                    {
                        label: 'Healthy',
                        data: weeklyData.healthy,
                        borderColor: '#10B981',
                        backgroundColor: 'rgba(16, 185, 129, 0.1)',
                        tension: 0.3
                    },
                    {
                        label: 'Suspected Bird Flu',
                        data: weeklyData.birdFlu,
                        borderColor: '#EF4444',
                        backgroundColor: 'rgba(239, 68, 68, 0.1)',
                        tension: 0.3
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true
                    }
                }
            }
        });
    }

    function getWeeklyData(analyses) {
        const result = {
            labels: [],
            healthy: [],
            birdFlu: []
        };

        const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
        result.labels = days;

        days.forEach(day => {
            result.healthy.push(Math.floor(Math.random() * 10));
            result.birdFlu.push(Math.floor(Math.random() * 3));
        });

        return result;
    }

    function renderPaginatedTable() {
        const startIndex = (currentPage - 1) * itemsPerPage;
        const endIndex = startIndex + itemsPerPage;
        const pageItems = filteredAnalyses.slice(startIndex, endIndex);

        updateReportTable(pageItems);
        renderPaginationControls();
    }

    function renderPaginationControls() {
        if (!paginationControls) return;

        const totalPages = Math.ceil(filteredAnalyses.length / itemsPerPage);

        if (totalPages <= 1) {
            paginationControls.innerHTML = '';
            return;
        }

        let paginationHTML = '';

        // Previous button
        if (currentPage > 1) {
            paginationHTML += `<li class="page-item"><a class="page-link" href="#" data-page="${currentPage - 1}">Previous</a></li>`;
        } else {
            paginationHTML += `<li class="page-item disabled"><span class="page-link">Previous</span></li>`;
        }

        // Page numbers
        const startPage = Math.max(1, currentPage - 2);
        const endPage = Math.min(totalPages, currentPage + 2);

        if (startPage > 1) {
            paginationHTML += `<li class="page-item"><a class="page-link" href="#" data-page="1">1</a></li>`;
            if (startPage > 2) {
                paginationHTML += `<li class="page-item disabled"><span class="page-link">...</span></li>`;
            }
        }

        for (let i = startPage; i <= endPage; i++) {
            if (i === currentPage) {
                paginationHTML += `<li class="page-item active"><span class="page-link">${i}</span></li>`;
            } else {
                paginationHTML += `<li class="page-item"><a class="page-link" href="#" data-page="${i}">${i}</a></li>`;
            }
        }

        if (endPage < totalPages) {
            if (endPage < totalPages - 1) {
                paginationHTML += `<li class="page-item disabled"><span class="page-link">...</span></li>`;
            }
            paginationHTML += `<li class="page-item"><a class="page-link" href="#" data-page="${totalPages}">${totalPages}</a></li>`;
        }

        // Next button
        if (currentPage < totalPages) {
            paginationHTML += `<li class="page-item"><a class="page-link" href="#" data-page="${currentPage + 1}">Next</a></li>`;
        } else {
            paginationHTML += `<li class="page-item disabled"><span class="page-link">Next</span></li>`;
        }

        paginationControls.innerHTML = paginationHTML;

        // Add event listeners to pagination links
        paginationControls.querySelectorAll('.page-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const page = parseInt(e.target.getAttribute('data-page'));
                if (page && page !== currentPage) {
                    currentPage = page;
                    renderPaginatedTable();
                }
            });
        });
    }

    async function initializeReports() {
        try {
            if (loadingSpinner) loadingSpinner.style.display = 'flex';

            const timeoutId = setTimeout(() => {
                if (loadingSpinner) loadingSpinner.style.display = 'none';
                console.error('Loading timeout exceeded');
            }, 5000);

            const analyses = await getAnalyses();
            // Filter out 'detection failed' analyses for reports
            const validAnalyses = analyses.filter(a => a.status.toLowerCase() !== 'detection failed');
            filteredAnalyses = validAnalyses; // Store valid analyses for filtering
            currentPage = 1; // Reset to first page
            updateCounts(analyses);
            renderPaginatedTable();
            initializeCharts(analyses);

            clearTimeout(timeoutId);
            if (loadingSpinner) loadingSpinner.style.display = 'none';
        } catch (error) {
            console.error('Error initializing reports:', error);
            if (loadingSpinner) loadingSpinner.style.display = 'none';
        }
    }

    initializeReports();
    document.addEventListener('analysisUpdated', initializeReports);

    window.deleteReport = async function(id) {
        if (!id) return;
        try {
            const response = await fetch(`/api/delete_analysis/${id}`, {
                method: 'DELETE'
            });
            const data = await response.json();
            if (data.success) {
                initializeReports();
            } else {
                alert('Error deleting analysis: ' + (data.error || 'Unknown error'));
            }
        } catch (error) {
            console.error('Error deleting analysis:', error);
            alert('Error deleting analysis: ' + error.message);
        }
    };

    // Sidebar functionality
    const toggleBtn = document.getElementById('sidebarToggle');
    const sidebar = document.getElementById('sidebar');
    const menuLinks = document.querySelectorAll('.sidebar-menu a');
    const currentPagePath = window.location.pathname.split('/').pop();

    // Highlight current page in sidebar
    menuLinks.forEach(link => {
        const linkPage = link.getAttribute('href').split('/').pop();
        if (linkPage === currentPagePath) {
            link.classList.add('active');
        }
    });

    // Sidebar toggle
    if (toggleBtn && sidebar) {
        toggleBtn.addEventListener('click', () => {
            sidebar.classList.toggle('collapsed');
            localStorage.setItem('sidebarCollapsed', sidebar.classList.contains('collapsed'));

            // Ensure active link remains visible when collapsed
            const activeLink = document.querySelector('.sidebar-menu a.active');
            if (activeLink && sidebar.classList.contains('collapsed')) {
                activeLink.querySelector('span').style.display = 'block';
            }
        });
    }

    // Load saved state
    const savedState = localStorage.getItem('sidebarCollapsed');
    if (savedState === 'true') {
        sidebar.classList.add('collapsed');
    }

    // Prevent sidebar from expanding when clicking menu items
    menuLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            if (sidebar.classList.contains('collapsed')) {
                e.stopPropagation();
            }
        });
    });

    sidebar.addEventListener('click', function(e) {
        if (sidebar.classList.contains('collapsed') &&
            e.target.closest('.sidebar-menu li a')) {
            e.stopPropagation();
        }
    });

    filterSelect.addEventListener('change', async () => {
        const selectedStatus = filterSelect.value.toLowerCase();
        const allAnalyses = await getAnalyses();
        // Filter out 'detection failed' analyses for reports
        const validAnalyses = allAnalyses.filter(a => a.status.toLowerCase() !== 'detection failed');

        if (selectedStatus === 'all') {
            filteredAnalyses = validAnalyses;
        } else {
            filteredAnalyses = validAnalyses.filter(analysis =>
                analysis.status.toLowerCase() === selectedStatus
            );
        }

        currentPage = 1; // Reset to first page when filtering
        renderPaginatedTable();
    });
});
