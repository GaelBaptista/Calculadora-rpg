// ==========================================================================
// SELECT CUSTOMIZADO — cursor de luva nas opções (dropdown nativo não permite)
// ==========================================================================
function getCselectList(wrapper) {
    return wrapper._cselectList;
}

function getCselectOptions(wrapper) {
    const list = getCselectList(wrapper);
    return list ? list.querySelectorAll('.cselect-option') : [];
}

function initCustomSelects() {
    document.querySelectorAll('select').forEach(select => {
        if (select.closest('.cselect') || select.dataset.cselectReady) return;
        select.dataset.cselectReady = '1';

        const wrapper = document.createElement('div');
        wrapper.className = 'cselect';

        const trigger = document.createElement('button');
        trigger.type = 'button';
        trigger.className = 'cselect-trigger';
        trigger.setAttribute('aria-haspopup', 'listbox');
        trigger.setAttribute('aria-expanded', 'false');
        if (select.id) {
            trigger.setAttribute('aria-labelledby', select.id + '-label');
            const label = document.querySelector(`label[for="${select.id}"]`);
            if (label && !label.id) label.id = select.id + '-label';
        }

        const labelSpan = document.createElement('span');
        labelSpan.className = 'cselect-trigger-text';

        const chevron = document.createElement('span');
        chevron.className = 'cselect-chevron';
        chevron.setAttribute('aria-hidden', 'true');
        chevron.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M7 10l5 5 5-5z"/></svg>';

        trigger.appendChild(labelSpan);
        trigger.appendChild(chevron);

        const list = document.createElement('ul');
        list.className = 'cselect-list';
        list.setAttribute('role', 'listbox');
        list.hidden = true;

        const options = Array.from(select.options).map((opt, index) => {
            const li = document.createElement('li');
            li.className = 'cselect-option';
            li.setAttribute('role', 'option');
            li.dataset.value = opt.value;
            li.textContent = opt.textContent;
            li.tabIndex = -1;
            if (opt.selected) li.setAttribute('aria-selected', 'true');
            li.addEventListener('click', () => chooseOption(wrapper, select, index));
            li.addEventListener('mouseenter', () => setActiveOption(wrapper, index));
            list.appendChild(li);
            return li;
        });

        wrapper._cselectList = list;

        select.classList.add('cselect-native');
        select.tabIndex = -1;

        const parent = select.parentNode;
        parent.insertBefore(wrapper, select);
        wrapper.appendChild(trigger);
        wrapper.appendChild(list);
        wrapper.appendChild(select);

        trigger.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleCustomSelect(wrapper);
        });

        list.addEventListener('click', (e) => e.stopPropagation());
        list.addEventListener('mousedown', (e) => e.stopPropagation());
        trigger.addEventListener('keydown', (e) => onTriggerKeydown(e, wrapper, select));
        list.addEventListener('keydown', (e) => onListKeydown(e, wrapper, select));

        syncCustomSelectDisplay(wrapper, select);
    });

    document.addEventListener('click', (e) => {
        if (e.target.closest('.cselect') || e.target.closest('.cselect-list')) return;
        closeAllCustomSelects();
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeAllCustomSelects();
    });
    window.addEventListener('resize', () => closeAllCustomSelects());
    window.addEventListener('scroll', (e) => {
        if (e.target.closest?.('.cselect-list')) return;
        closeAllCustomSelects();
    }, true);
}

function syncCustomSelectDisplay(wrapper, select) {
    const text = wrapper.querySelector('.cselect-trigger-text');
    const options = getCselectOptions(wrapper);
    const idx = select.selectedIndex;
    if (text && select.options[idx]) {
        text.textContent = select.options[idx].textContent;
    }
    options.forEach((li, i) => {
        const active = i === idx;
        li.classList.toggle('is-selected', active);
        li.setAttribute('aria-selected', active ? 'true' : 'false');
    });
}

function toggleCustomSelect(wrapper) {
    const isOpen = wrapper.classList.contains('is-open');
    closeAllCustomSelects();
    if (!isOpen) openCustomSelect(wrapper);
}

function mountListPortal(wrapper) {
    const list = getCselectList(wrapper);
    if (!list || list.dataset.portalMounted === '1') return;
    list.dataset.portalMounted = '1';
    list.classList.add('is-portal');
    document.body.appendChild(list);
}

function unmountListPortal(wrapper) {
    const list = getCselectList(wrapper);
    if (!list || list.dataset.portalMounted !== '1') return;
    const select = wrapper.querySelector('select');
    list.dataset.portalMounted = '0';
    list.classList.remove('is-portal');
    list.style.top = '';
    list.style.left = '';
    list.style.width = '';
    wrapper.insertBefore(list, select);
}

function openCustomSelect(wrapper) {
    const list = getCselectList(wrapper);
    const trigger = wrapper.querySelector('.cselect-trigger');
    const select = wrapper.querySelector('select');
    wrapper.classList.add('is-open');
    mountListPortal(wrapper);
    list.hidden = false;
    trigger.setAttribute('aria-expanded', 'true');
    positionCustomSelectList(wrapper);
    setActiveOption(wrapper, select.selectedIndex);
    const active = list.querySelector('.cselect-option.is-active');
    if (active) active.scrollIntoView({ block: 'nearest' });
}

function positionCustomSelectList(wrapper) {
    const trigger = wrapper.querySelector('.cselect-trigger');
    const list = getCselectList(wrapper);
    if (!trigger || !list) return;
    const rect = trigger.getBoundingClientRect();
    list.style.top = `${rect.bottom + 4}px`;
    list.style.left = `${rect.left}px`;
    list.style.width = `${rect.width}px`;
}

function closeAllCustomSelects() {
    document.querySelectorAll('.cselect.is-open').forEach(wrapper => {
        wrapper.classList.remove('is-open');
        const list = getCselectList(wrapper);
        const trigger = wrapper.querySelector('.cselect-trigger');
        if (list) list.hidden = true;
        if (trigger) trigger.setAttribute('aria-expanded', 'false');
        unmountListPortal(wrapper);
    });
}

function setActiveOption(wrapper, index) {
    getCselectOptions(wrapper).forEach((li, i) => li.classList.toggle('is-active', i === index));
}

function chooseOption(wrapper, select, index) {
    if (select.selectedIndex === index) {
        closeAllCustomSelects();
        return;
    }
    select.selectedIndex = index;
    syncCustomSelectDisplay(wrapper, select);
    select.dispatchEvent(new Event('change', { bubbles: true }));
    closeAllCustomSelects();
}

function onTriggerKeydown(e, wrapper, select) {
    if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openCustomSelect(wrapper);
    }
}

function onListKeydown(e, wrapper, select) {
    const items = getCselectOptions(wrapper);
    let idx = Array.from(items).findIndex(li => li.classList.contains('is-active'));
    if (idx < 0) idx = select.selectedIndex;

    if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveOption(wrapper, Math.min(idx + 1, items.length - 1));
    } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveOption(wrapper, Math.max(idx - 1, 0));
    } else if (e.key === 'Enter') {
        e.preventDefault();
        const activeIdx = Array.from(items).findIndex(li => li.classList.contains('is-active'));
        chooseOption(wrapper, select, activeIdx >= 0 ? activeIdx : select.selectedIndex);
    } else if (e.key === 'Escape') {
        e.preventDefault();
        closeAllCustomSelects();
        wrapper.querySelector('.cselect-trigger')?.focus();
    }
}

function refreshCustomSelect(select) {
    const wrapper = select?.closest?.('.cselect');
    if (wrapper) syncCustomSelectDisplay(wrapper, select);
}
