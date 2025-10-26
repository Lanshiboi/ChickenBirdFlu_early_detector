/**
 * Menu functionality for the Chicken Health Detection System
 * Handles sidebar navigation and menu interactions
 */

(function() {
    'use strict';

    // Initialize menu functionality when DOM is loaded
    document.addEventListener('DOMContentLoaded', function() {
        initializeSidebar();
        initializeNavigation();
    });

    function initializeSidebar() {
        const sidebar = document.getElementById('sidebar');
        const toggleBtn = document.getElementById('sidebarToggle');
        const menuLinks = document.querySelectorAll('.sidebar-menu a');

        if (!sidebar || !toggleBtn) {
            console.warn('Sidebar elements not found');
            return;
        }

        // Sidebar toggle functionality
        toggleBtn.addEventListener('click', function() {
            sidebar.classList.toggle('collapsed');

            // Save state to localStorage
            const isCollapsed = sidebar.classList.contains('collapsed');
            localStorage.setItem('sidebarCollapsed', isCollapsed);

            // Ensure active link remains visible when collapsed
            const activeLink = document.querySelector('.sidebar-menu a.active');
            if (activeLink && isCollapsed) {
                activeLink.querySelector('span').style.display = 'block';
            }
        });

        // Load saved sidebar state
        const savedState = localStorage.getItem('sidebarCollapsed');
        if (savedState === 'true') {
            sidebar.classList.add('collapsed');
        }

        // Handle menu link clicks
        menuLinks.forEach(function(link) {
            link.addEventListener('click', function(e) {
                if (sidebar.classList.contains('collapsed')) {
                    e.stopPropagation();
                }
            });
        });

        // Prevent sidebar expansion when clicking menu items in collapsed state
        sidebar.addEventListener('click', function(e) {
            if (sidebar.classList.contains('collapsed') &&
                e.target.closest('.sidebar-menu li a')) {
                e.stopPropagation();
            }
        });
    }

    function initializeNavigation() {
        const menuLinks = document.querySelectorAll('.sidebar-menu a');
        const currentPage = window.location.pathname.split('/').pop();

        // Highlight current page in sidebar
        menuLinks.forEach(function(link) {
            const linkPage = link.getAttribute('href').split('/').pop();
            if (linkPage === currentPage) {
                link.classList.add('active');
            }
        });
    }

    // Public API for external use
    window.MenuUtils = {
        toggleSidebar: function() {
            const toggleBtn = document.getElementById('sidebarToggle');
            if (toggleBtn) {
                toggleBtn.click();
            }
        },

        collapseSidebar: function() {
            const sidebar = document.getElementById('sidebar');
            if (sidebar && !sidebar.classList.contains('collapsed')) {
                sidebar.classList.add('collapsed');
                localStorage.setItem('sidebarCollapsed', 'true');
            }
        },

        expandSidebar: function() {
            const sidebar = document.getElementById('sidebar');
            if (sidebar && sidebar.classList.contains('collapsed')) {
                sidebar.classList.remove('collapsed');
                localStorage.setItem('sidebarCollapsed', 'false');
            }
        }
    };

    console.log('Menu functionality initialized successfully');
})();
