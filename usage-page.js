(function () {
    'use strict';

    function updateDropdownSummary(dropdown) {
        if (!dropdown) {
            return;
        }

        var summary = dropdown.querySelector('.ms-summary');

        if (!summary) {
            return;
        }

        var selector = 'input[type="checkbox"]:not([data-select-all])';
        var inputs = Array.from(dropdown.querySelectorAll(selector));

        var selectedInputs = inputs.filter(function (input) {
            return input.checked;
        });

        if (selectedInputs.length === 0) {
            summary.textContent = dropdown.dataset.placeholder || 'Select';
            summary.title = '';
            return;
        }

        summary.textContent = selectedInputs.length + ' selected';
        summary.title = selectedInputs.length + ' selected';
    }

    function updateAllDropdownSummaries() {
        updateDropdownSummary(document.getElementById('departmentDropdown'));
        updateDropdownSummary(document.getElementById('vendorDropdown'));
        updateDropdownSummary(document.getElementById('campaignDropdown'));
    }

    var cascadeApi = setupCascadeFilters();
    setupFilterValidation();
    showServerErrorNotification();
    setupUsagePageState(cascadeApi);

    function ensureNotificationHost() {
        var host = document.querySelector('.usage-notification-host');
        if (host) {
            return host;
        }

        host = document.createElement('div');
        host.className = 'usage-notification-host';
        document.body.appendChild(host);
        return host;
    }

    function showErrorNotification(message) {
        var host = ensureNotificationHost();
        var toast = document.createElement('div');
        var text = document.createElement('span');
        var closeButton = document.createElement('button');

        toast.className = 'usage-notification usage-notification-error';
        toast.setAttribute('role', 'alert');

        text.className = 'usage-notification-text';
        text.textContent = message;

        closeButton.type = 'button';
        closeButton.className = 'usage-notification-close';
        closeButton.setAttribute('aria-label', 'Close notification');
        closeButton.textContent = '×';

        toast.appendChild(text);
        toast.appendChild(closeButton);
        host.appendChild(toast);

        function dismissToast() {
            if (!toast.isConnected) {
                return;
            }

            toast.classList.add('is-hiding');
            window.setTimeout(function () {
                toast.remove();
            }, 250);
        }

        closeButton.addEventListener('click', dismissToast);
        window.setTimeout(dismissToast, 5000);
    }

    function showFetchingNotification() {
        var host = ensureNotificationHost();
        var toast = document.createElement('div');
        var text = document.createElement('span');
        var closeButton = document.createElement('button');

        toast.className = 'usage-notification usage-notification-fetching';
        toast.setAttribute('role', 'status');
        text.className = 'usage-notification-text';
        text.textContent = 'Fetching..';
        closeButton.type = 'button';
        closeButton.className = 'usage-notification-close';
        closeButton.setAttribute('aria-label', 'Close notification');
        closeButton.textContent = '×';
        toast.appendChild(text);
        toast.appendChild(closeButton);
        host.appendChild(toast);

        closeButton.addEventListener('click', function () {
            toast.remove();
        });
    }

    function setupFilterValidation() {
        var form = document.getElementById('usageFilterForm');
        if (!form) {
            return;
        }

        form.addEventListener('submit', function (event) {
            var hasCampaign = form.querySelector('input[name="CampaignIds"]:checked') !== null;
            var fromValue = form.querySelector('input[name="From"]').value;
            var toValue = form.querySelector('input[name="To"]').value;

            if (!fromValue || !toValue) {
                event.preventDefault();
                showErrorNotification('Both From and To date must be specified');
                return;
            }

            if (!hasCampaign) {
                event.preventDefault();
                showErrorNotification('No campaign selected');
                return;
            }

            // Campaign-only filtering is valid: no department/vendor required in this state.
            event.preventDefault();
            showFetchingNotification();
            window.setTimeout(function () {
                HTMLFormElement.prototype.submit.call(form);
            }, 50);
        });
    }

    function showServerErrorNotification() {
        var form = document.getElementById('usageFilterForm');
        if (!form) {
            return;
        }

        var message = form.dataset.errorMessage;
        if (!message) {
            return;
        }

        showErrorNotification(message);
        form.dataset.errorMessage = '';
    }

    function setupCascadeFilters() {
        var departmentPanel = document.getElementById('departmentPanel');
        var vendorPanel = document.getElementById('vendorPanel');
        var campaignPanel = document.getElementById('campaignPanel');

        if (!departmentPanel || !vendorPanel || !campaignPanel) {
            return null;
        }

        var departmentInputs = Array.from(departmentPanel.querySelectorAll('input[name="DepartmentIds"]'));
        var vendorInputs = Array.from(vendorPanel.querySelectorAll('input[name="VendorIds"]'));
        var campaignInputs = Array.from(campaignPanel.querySelectorAll('input[name="CampaignIds"]'));
        var selectAllInputs = Array.from(document.querySelectorAll('input[data-select-all="true"]'));

        function selectedIds(inputs) {
            return new Set(inputs.filter(function (input) {
                return input.checked;
            }).map(function (input) {
                return Number(input.value);
            }));
        }

        function setVisible(input, visible) {
            var option = input.closest('.ms-option');
            if (!option) {
                return;
            }

            option.hidden = !visible;
            if (!visible) {
                input.checked = false;
            }
        }

        function syncSelectAll(selectAllInput) {
            var panel = selectAllInput.closest('.ms-panel');
            var visibleInputs = Array.from(panel.querySelectorAll('input[type="checkbox"]:not([data-select-all])'))
                .filter(function (input) {
                    var option = input.closest('.ms-option');
                    return option && !option.hidden;
                });
            var selectedCount = visibleInputs.filter(function (input) { return input.checked; }).length;

            selectAllInput.disabled = visibleInputs.length === 0;
            selectAllInput.checked = visibleInputs.length > 0 && selectedCount === visibleInputs.length;
            selectAllInput.indeterminate = selectedCount > 0 && selectedCount < visibleInputs.length;
        }

        function refreshCascade() {
            var departmentIds = selectedIds(departmentInputs);

            vendorInputs.forEach(function (vendorInput) {
                var relatedDepartments = (vendorInput.dataset.departmentIds || '')
                    .split(',')
                    .filter(Boolean)
                    .map(Number);
                var visible = departmentIds.size > 0 &&
                    relatedDepartments.some(function (id) { return departmentIds.has(id); });
                setVisible(vendorInput, visible);
            });

            var vendorIds = selectedIds(vendorInputs);
            campaignInputs.forEach(function (campaignInput) {
                var departmentId = Number(campaignInput.dataset.departmentId);
                var vendorId = Number(campaignInput.dataset.vendorId);
                var departmentMatches = departmentIds.size > 0 && departmentIds.has(departmentId);
                var vendorMatches = vendorIds.size > 0 && vendorIds.has(vendorId);
                setVisible(campaignInput, departmentMatches && vendorMatches);
            });

            selectAllInputs.forEach(syncSelectAll);
            updateAllDropdownSummaries();
        }

        selectAllInputs.forEach(function (selectAllInput) {
            selectAllInput.addEventListener('change', function () {
                var panel = selectAllInput.closest('.ms-panel');
                Array.from(panel.querySelectorAll('input[type="checkbox"]:not([data-select-all])'))
                    .forEach(function (input) {
                        var option = input.closest('.ms-option');
                        if (option && !option.hidden) {
                            input.checked = selectAllInput.checked;
                        }
                    });
                refreshCascade();
            });
        });

        [departmentPanel, vendorPanel, campaignPanel].forEach(function (panel) {
            panel.addEventListener('change', function (event) {
                if (!event.target.hasAttribute('data-select-all')) {
                    refreshCascade();
                }
            });
        });

        refreshCascade();

        return {
            cascadeOptions: refreshCascade
        };
    }

    function setupUsagePageState(cascadeApi) {
        var form = document.getElementById('usageFilterForm');
        var clearButton = document.getElementById('usageClearButton');
        var resultsHost = document.getElementById('usageResultsHost');

        if (!form || !clearButton) {
            return;
        }

        var fromInput = form.querySelector('input[name="From"]');
        var toInput = form.querySelector('input[name="To"]');
        var departmentInputs = Array.from(form.querySelectorAll('input[name="DepartmentIds"]'));
        var vendorInputs = Array.from(form.querySelectorAll('input[name="VendorIds"]'));
        var campaignInputs = Array.from(form.querySelectorAll('input[name="CampaignIds"]'));
        var allFilterInputs = departmentInputs.concat(vendorInputs, campaignInputs);
        var stateKey = '__vbmis_usage_state__';

        if (isPageReload()) {
            clearStoredState();
        }

        var restoredState = readStoredState();
        var shouldRestoreState = !!restoredState && !restoredState.suppressNextRestore;

        if (shouldRestoreState) {
            applyState(restoredState);
        }
        else {
            if ((!fromInput || !fromInput.value) || (!toInput || !toInput.value)) {
                setDefaultDateRange();
            }

            if (cascadeApi && typeof cascadeApi.cascadeOptions === 'function') {
                cascadeApi.cascadeOptions();
            }

            // Fresh Usage load starts empty even if server markup contains initial rows.
            if (!hasAnySelection()) {
                hideResultsHost();
            }
        }

        updateAllDropdownSummaries();

        allFilterInputs.forEach(function (input) {
            input.addEventListener('change', saveState);
        });

        if (fromInput) {
            fromInput.addEventListener('change', saveState);
        }

        if (toInput) {
            toInput.addEventListener('change', saveState);
        }

        form.addEventListener('submit', function () {
            saveState({ suppressNextRestore: true });
        });
        window.addEventListener('pagehide', function () {
            saveState();
        });

        clearButton.addEventListener('click', function (event) {
            event.preventDefault();

            clearSelections(departmentInputs, vendorInputs, campaignInputs);
            setDefaultDateRange();

            if (cascadeApi && typeof cascadeApi.cascadeOptions === 'function') {
                cascadeApi.cascadeOptions();
            }

            clearResultsHost();
            updateAllDropdownSummaries();
            saveState();
        });

        saveState();

        function formatDateTimeLocal(value) {
            var year = value.getFullYear();
            var month = String(value.getMonth() + 1).padStart(2, '0');
            var day = String(value.getDate()).padStart(2, '0');
            var hours = String(value.getHours()).padStart(2, '0');
            var minutes = String(value.getMinutes()).padStart(2, '0');
            return year + '-' + month + '-' + day + 'T' + hours + ':' + minutes;
        }

        function setDefaultDateRange() {
            var now = new Date();
            var startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);

            if (fromInput) {
                fromInput.value = formatDateTimeLocal(startOfMonth);
            }

            if (toInput) {
                toInput.value = formatDateTimeLocal(now);
            }
        }

        function clearSelections(departments, vendors, campaigns) {
            departments.forEach(function (input) { input.checked = false; });
            vendors.forEach(function (input) { input.checked = false; });
            campaigns.forEach(function (input) { input.checked = false; });
        }

        function hasAnySelection() {
            return allFilterInputs.some(function (input) { return input.checked; });
        }

        function getCheckedValues(inputs) {
            return inputs
                .filter(function (input) { return input.checked; })
                .map(function (input) { return Number(input.value); });
        }

        function setCheckedValues(inputs, values) {
            var allowed = new Set(values || []);
            inputs.forEach(function (input) {
                input.checked = allowed.has(Number(input.value));
            });
        }

        function hideResultsHost() {
            if (!resultsHost) {
                return;
            }

            resultsHost.hidden = true;
        }

        function clearResultsHost() {
            if (!resultsHost) {
                return;
            }

            resultsHost.innerHTML = '';
            resultsHost.hidden = true;
            resultsHost.dataset.hasResults = 'false';
        }

        function applyState(state) {
            setCheckedValues(departmentInputs, state.departmentIds);
            setCheckedValues(vendorInputs, state.vendorIds);
            setCheckedValues(campaignInputs, state.campaignIds);

            if (fromInput && typeof state.from === 'string') {
                fromInput.value = state.from;
            }

            if (toInput && typeof state.to === 'string') {
                toInput.value = state.to;
            }

            if (cascadeApi && typeof cascadeApi.cascadeOptions === 'function') {
                cascadeApi.cascadeOptions();
            }

            if (resultsHost && typeof state.resultsHtml === 'string') {
                resultsHost.innerHTML = state.resultsHtml;
                resultsHost.hidden = !!state.resultsHidden;
                resultsHost.dataset.hasResults = state.resultsHtml.trim().length > 0 ? 'true' : 'false';
            }
        }

        function readStateBucket() {
            if (!window.name) {
                return {};
            }

            try {
                var parsed = JSON.parse(window.name);
                return parsed && typeof parsed === 'object' ? parsed : {};
            }
            catch (_error) {
                return {};
            }
        }

        function writeStateBucket(bucket) {
            window.name = JSON.stringify(bucket);
        }

        function readStoredState() {
            var bucket = readStateBucket();
            return bucket[stateKey] || null;
        }

        function clearStoredState() {
            var bucket = readStateBucket();
            delete bucket[stateKey];
            writeStateBucket(bucket);
        }

        function saveState(options) {
            var bucket = readStateBucket();
            var shouldSuppressNextRestore = !!(options && options.suppressNextRestore);

            bucket[stateKey] = {
                departmentIds: getCheckedValues(departmentInputs),
                vendorIds: getCheckedValues(vendorInputs),
                campaignIds: getCheckedValues(campaignInputs),
                from: fromInput ? fromInput.value : '',
                to: toInput ? toInput.value : '',
                resultsHtml: resultsHost ? resultsHost.innerHTML : '',
                resultsHidden: resultsHost ? resultsHost.hidden : true,
                suppressNextRestore: shouldSuppressNextRestore
            };
            writeStateBucket(bucket);
        }

        function isPageReload() {
            var entries = window.performance && window.performance.getEntriesByType
                ? window.performance.getEntriesByType('navigation')
                : [];

            if (entries.length > 0 && entries[0].type) {
                return entries[0].type === 'reload';
            }

            if (window.performance && window.performance.navigation) {
                return window.performance.navigation.type === 1;
            }

            return false;
        }
    }

})();
