/**
 * Инициализирует панель управления учениками
 * @param {Array} studentsList - Список учеников в формате [{id: number, name: string}, ...]
 */
function initStudentPanel(studentsList) {
    const dropdownMenu = document.getElementById('studentDropdownMenu');

    if (studentsList && studentsList.length > 0) {
        const divider = document.createElement('li');
        divider.innerHTML = '<hr class="dropdown-divider">';
        dropdownMenu.appendChild(divider);

        studentsList.forEach(student => {
            const li = document.createElement('li');
            li.innerHTML = `<a class="dropdown-item student-option" href="#" data-student-id="${student.id}">${student.name}</a>`;
            dropdownMenu.appendChild(li);
        });

        const addStudentLi = document.createElement('li');
        addStudentLi.innerHTML = `
            <button class="dropdown-item text-warning" id="addStudentButton" data-bs-toggle="modal" data-bs-target="#invitationModal">
                <i class="bi bi-person-plus me-2"></i> Добавить ученика
            </button>
        `;
        dropdownMenu.appendChild(addStudentLi);
    }

    document.querySelectorAll('#studentDropdownMenu .dropdown-item').forEach(item => {
        item.addEventListener('click', function(e) {
            if (this.id === 'addStudentButton') {
                const modal = new bootstrap.Modal(document.getElementById('invitationModal'));
                modal.show();
                return;
            }

            e.preventDefault();

            document.querySelectorAll('#studentDropdownMenu .student-option').forEach(i => {
                i.classList.remove('active');
            });

            this.classList.add('active');

            const button = document.getElementById('studentDropdown');
            const studentName = this.textContent.trim();
            const studentId = this.dataset.studentId;

            button.textContent = studentName;

            loadStudentData(studentId);
        });
    });

    document.getElementById('disableCopyingButton').addEventListener('click', function(e) {
        e.preventDefault();

        const isCurrentlyAllowed = document.body.classList.contains('copy-allowed');
        const icon = this.querySelector('i');
        const text = this.querySelector('.text');

        if (isCurrentlyAllowed) {
            document.body.classList.remove('copy-allowed');
            document.body.style.userSelect = 'none';
            icon.classList.remove('bi-ban');
            icon.classList.add('bi-check-lg');
            text.textContent = 'Запретить копирование';
            this.classList.remove('text-success');
            this.classList.add('text-danger');
            showNotification('Копирование запрещено');
        } else {
            document.body.classList.add('copy-allowed');
            document.body.style.userSelect = 'text';
            icon.classList.remove('bi-check-lg');
            icon.classList.add('bi-ban');
            text.textContent = 'Разрешить копирование';
            this.classList.remove('text-danger');
            this.classList.add('text-success');
            showNotification('Копирование разрешено');
        }
    });

    document.getElementById('refreshPageButton').addEventListener('click', function() {
        location.reload();
    });
}

/**
 * Загружает данные выбранного ученика и обновляет отображение ответов
 * @param {string} studentId - ID ученика или "all" для всего класса
 */
function loadStudentData(studentId) {
    try {
        currentUserId = studentId
        handleSectionAnswers(sectionId);
    } catch (error) {
        console.error('Ошибка при загрузке данных ученика:', error);
        showNotification('Не удалось загрузить данные ученика');
    }
}