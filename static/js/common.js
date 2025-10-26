// Common functionality for all pages
document.addEventListener('DOMContentLoaded', function() {
    initSidebar();
    initQWebChannel();
});

// Sidebar functionality
function initSidebar() {
    const toggleBtn = document.getElementById('sidebarToggle');
    const sidebar = document.getElementById('sidebar');
    const menuLinks = document.querySelectorAll('.sidebar-menu a');
    const currentPage = window.location.pathname.split('/').pop();

    // Highlight current page in sidebar
    menuLinks.forEach(link => {
        const linkPage = link.getAttribute('href').split('/').pop();
        if (linkPage === currentPage) {
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
}

// QWebChannel initialization for PyQt5 integration
function initQWebChannel() {
    // Backend integration (optional - only works in PyQt5 environment)
    window.backend = null;

    // Load QWebChannel script for PyQt5 integration
    (function() {
        function loadScript(src, onload, onerror) {
            var script = document.createElement('script');
            script.src = src;
            script.onload = onload;
            script.onerror = onerror;
            document.head.appendChild(script);
        }

        function initializeQWebChannel() {
            if (typeof QWebChannel !== 'undefined' && window.qt && window.qt.webChannelTransport) {
                try {
                    console.log('Initializing QWebChannel...');
                    new QWebChannel(window.qt.webChannelTransport, function(channel) {
                        console.log('QWebChannel initialized successfully');
                        window.backend = channel.objects.backend;
                        if (window.backend) {
                            console.log('Backend object connected:', window.backend);
                        } else {
                            console.warn('Backend object not found in channel.objects');
                        }
                    });
                } catch (error) {
                    console.error('QWebChannel initialization failed:', error);
                }
            } else {
                console.warn('QWebChannel or qt.webChannelTransport not available');
            }
        }

        // Try to load from qrc first
        loadScript('qrc:///qtwebchannel/qwebchannel.js', function() {
            console.log('QWebChannel script loaded from qrc');
            initializeQWebChannel();
        }, function() {
            console.warn('Failed to load QWebChannel script from qrc');
            // Fallback to local if available
            if (typeof QWebChannel === 'undefined') {
                loadScript('assets/js/qwebchannel_fixed.js', function() {
                    console.log('QWebChannel script loaded from local fallback');
                    initializeQWebChannel();
                }, function() {
                    console.warn('Failed to load QWebChannel script from local fallback');
                });
            } else {
                initializeQWebChannel();
            }
        });
    })();

    // Navigation function (works with or without backend)
    window.navigate = function(page) {
        if (window.backend && window.backend.navigate_to) {
            window.backend.navigate_to(page);
        } else {
            // Fallback to regular navigation
            window.location.href = page;
        }
    };
}

// Utility functions
function normalizeStatus(status) {
    if (!status) return null;
    const s = String(status).trim().toLowerCase();
    if (s === 'healthy') return 'healthy';
    if (s === 'birdflu' || s === 'bird flu' || s === 'suspected bird flu') return 'birdflu';
    return null;
}

function getStatusClass(status) {
    const norm = normalizeStatus(status);
    switch(norm) {
        case 'healthy': return 'status-healthy';
        case 'birdflu': return 'status-suspected-bird-flu';
        default: return 'status-secondary';
    }
}

// Expose utility functions globally
window.normalizeStatus = normalizeStatus;
window.getStatusClass = getStatusClass;
