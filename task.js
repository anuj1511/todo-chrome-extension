let currentSort = 'time-desc';

function initializeTaskFeatures() {
    const todoInput = document.querySelector('.todo-input');
    const sortButton = document.querySelector('.sort-button');
    const sortMenu = document.querySelector('.sort-menu');

    // Sort button click handler
    sortButton?.addEventListener('click', (e) => {
        e.stopPropagation();
        sortMenu.classList.toggle('show');
    });

    // Close sort menu when clicking outside
    document.addEventListener('click', (e) => {
        if (!sortMenu?.contains(e.target) && !sortButton?.contains(e.target)) {
            sortMenu?.classList.remove('show');
        }
    });

    // Sort options click handler
    document.querySelectorAll('.sort-option').forEach(option => {
        option.addEventListener('click', (e) => {
            e.stopPropagation();
            currentSort = option.dataset.sort;
            
            document.querySelectorAll('.sort-option').forEach(opt => {
                opt.classList.remove('active');
            });
            option.classList.add('active');

            chrome.storage.sync.get(['todos'], (result) => {
                const todos = result.todos || [];
                renderTodos(todos);
            });
            
            sortMenu.classList.remove('show');
        });
    });

    // Add new todo
    todoInput?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && todoInput.value.trim()) {
            const todo = {
                text: todoInput.value.trim(),
                completed: false,
                id: Date.now(),
                details: ''
            };
            
            chrome.storage.sync.get(['todos'], (result) => {
                const todos = result.todos || [];
                todos.push(todo);
                chrome.storage.sync.set({ todos }, () => {
                    renderTodos(todos);
                    todoInput.value = '';
                });
            });
        }
    });

    // Collapse buttons handler
    document.querySelectorAll('.collapse-btn').forEach(button => {
        button.addEventListener('click', () => {
            const section = button.dataset.section;
            const container = section === 'active' ? 
                document.getElementById('active-tasks') : 
                document.getElementById('completed-tasks');
            
            // Only collapse the details sections, not the todo items
            const expandedDetails = container.querySelectorAll('.todo-details.expanded');
            expandedDetails.forEach(detail => {
                // Save details before collapsing
                const todoId = parseInt(detail.previousElementSibling.dataset.todoId);
                if (todoId) {
                    saveDetails(todoId, detail);
                }
                detail.classList.remove('expanded');
            });
        });
    });

    // Load initial todos
    chrome.storage.sync.get(['todos'], (result) => {
        const todos = result.todos || [];
        renderTodos(todos);
    });
}

function renderTodos(todos) {
    // Get all required elements
    const todoList = document.getElementById('todo-list');
    if (!todoList) return; // Exit if main container isn't found

    const activeTasks = todoList.querySelector('#active-tasks');
    const completedTasks = todoList.querySelector('#completed-tasks');
    const activeHeader = todoList.querySelector('.section-header[data-section="active"]');
    const completedHeader = todoList.querySelector('.section-header[data-section="completed"]');
    
    // Verify all required elements exist
    if (!activeTasks || !completedTasks || !activeHeader || !completedHeader) {
        console.error('Required elements not found');
        return;
    }

    // Clear existing content
    activeTasks.innerHTML = '';
    completedTasks.innerHTML = '';
    
    // Sort and filter todos
    const sortedTodos = sortTodos(todos, currentSort);
    const active = sortedTodos.filter(todo => !todo.completed);
    const completed = sortedTodos.filter(todo => todo.completed);
    
    // Handle active tasks section
    if (active.length === 0) {
        const emptyMessage = document.createElement('div');
        emptyMessage.className = 'empty-state';
        emptyMessage.textContent = 'Add new tasks to see them here';
        activeTasks.appendChild(emptyMessage);
    } else {
        active.forEach(todo => addTodoElement(todo, activeTasks));
    }

    // Handle completed tasks section
    completedHeader.classList.toggle('hidden', completed.length === 0);
    completedTasks.classList.toggle('hidden', completed.length === 0);
    
    if (completed.length > 0) {
        completed.forEach(todo => addTodoElement(todo, completedTasks));
    }
}

function addTodoElement(todo, container) {
    const div = document.createElement('div');
    div.className = 'todo-item';
    div.dataset.todoId = todo.id;
    div.innerHTML = `
        <input type="checkbox" ${todo.completed ? 'checked' : ''}>
        <span class="${todo.completed ? 'completed' : ''}">${todo.text}</span>
        <div class="todo-actions">
            <button class="delete-btn" title="Delete task">X</button>
        </div>
    `;

    const detailsDiv = document.createElement('div');
    detailsDiv.className = 'todo-details';
    detailsDiv.contentEditable = true;
    
    if (todo.details) {
        detailsDiv.innerHTML = todo.details
            .split('\n')
            .join('<br>');
    }

    detailsDiv.addEventListener('focus', () => {
        if (!todo.details || todo.details.trim() === '') {
            detailsDiv.textContent = '';
        }
    });

    detailsDiv.addEventListener('blur', () => {
        if (!detailsDiv.textContent.trim()) {
            detailsDiv.textContent = '';
        }
        saveDetails(todo.id, detailsDiv);
    });

    detailsDiv.addEventListener('input', () => {
        saveDetails(todo.id, detailsDiv);
    });

    detailsDiv.addEventListener('paste', (e) => {
        e.preventDefault();
        const text = e.clipboardData.getData('text/plain');
        document.execCommand('insertText', false, text);
    });

    div.addEventListener('click', (e) => {
        if (e.target.type !== 'checkbox' && !e.target.classList.contains('delete-btn')) {
            detailsDiv.classList.toggle('expanded');
        }
    });

    const checkbox = div.querySelector('input');
    checkbox.addEventListener('change', () => {
        chrome.storage.sync.get(['todos'], (result) => {
            const todos = result.todos || [];
            const todoIndex = todos.findIndex(t => t.id === todo.id);
            if (todoIndex !== -1) {
                todos[todoIndex].completed = checkbox.checked;
                chrome.storage.sync.set({ todos }, () => {
                    renderTodos(todos);
                });
            }
        });
    });

    const deleteBtn = div.querySelector('.delete-btn');
    deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        chrome.storage.sync.get(['todos'], (result) => {
            const todos = result.todos || [];
            const updatedTodos = todos.filter(t => t.id !== todo.id);
            chrome.storage.sync.set({ todos: updatedTodos }, () => {
                renderTodos(updatedTodos);
            });
        });
    });

    container.appendChild(div);
    container.appendChild(detailsDiv);
}

function saveDetails(todoId, detailsDiv) {
    const newDetails = detailsDiv.innerHTML
        .replace(/<div><br><\/div>/g, '\n')
        .replace(/<br>/g, '\n')
        .replace(/<div>/g, '\n')
        .replace(/<\/div>/g, '')
        .replace(/&nbsp;/g, ' ')
        .trim();
    
    chrome.storage.sync.get(['todos'], (result) => {
        const todos = result.todos || [];
        const todoIndex = todos.findIndex(t => t.id === todoId);
        if (todoIndex !== -1) {
            todos[todoIndex].details = newDetails;
            chrome.storage.sync.set({ todos });
        }
    });
}

function sortTodos(todos, sortType) {
    const sortFunctions = {
        'time-desc': (a, b) => b.id - a.id,
        'time-asc': (a, b) => a.id - b.id,
        'alpha-asc': (a, b) => a.text.localeCompare(b.text),
        'alpha-desc': (a, b) => b.text.localeCompare(a.text)
    };

    return [...todos].sort(sortFunctions[sortType]);
}

// Initialize features when DOM is loaded
document.addEventListener('DOMContentLoaded', initializeTaskFeatures);
