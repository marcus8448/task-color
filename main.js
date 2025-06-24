/*
 * Copyright (C) 2025 Marcus Low
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as published by
 * the Free Software Foundation, version 3.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with this program. If not, see https://www.gnu.org/licenses/.
 */

// event colors are stored in local storage
// format: task_color_<task id> -> <color>

// globals to keep track of color being set
let pendingColor = null;
let creatingEvent = null;
let pendingCreation = false;
let editObserver = null;

function onElementAdded(node) {
    if (node.nodeType === Node.ELEMENT_NODE) {
        if (node.getAttribute("aria-labelledby") === "tabTask") { // task creation dialog
            node.appendChild(createColorPickerRow())
        } else if (node.hasAttribute("data-taskid")) { // select task view dialog (one click)
            if (node.parentElement != null
                && node.parentElement.parentElement != null
                && node.parentElement.parentElement.getAttribute("role") === "dialog") {
                if (editObserver != null) {
                    editObserver.expire = true;
                    editObserver = null;
                }

                let taskId = node.getAttribute("data-taskid")
                let chipNode = node.childNodes.item(1).firstChild.firstChild.firstChild.firstChild;
                let baseColor;
                if (hasTaskColor(taskId)) {
                    // color the dot in the task view dialog
                    baseColor = getTaskColor(taskId)
                    chipNode.style.backgroundColor = baseColor;
                } else { // get default task color
                    baseColor = parseCssColor(chipNode.style.backgroundColor)
                }

                // create edit color button
                let input = document.createElement("input");
                input.type = "color";
                input.value = baseColor;

                let taskChip = getTaskChip(taskId);
                if (taskChip != null && hasTaskColor(taskId)) {
                    // in week view, style is manually updated on click (with timed tasks) - counteract changes
                    colorEventChip(taskChip, input.value)

                    let observer = new MutationObserver(_ => {
                        colorEventChip(taskChip, input.value)
                        if (observer.expire) observer.disconnect();
                    });
                    observer.observe(taskChip, {
                        attributes: true,
                        attributeFilter: ["style"],
                    });
                    editObserver = observer
                }

                input.oninput = event => {
                    setTaskColor(taskId, event.target.value);
                    colorEventChip(taskChip, event.target.value);
                    chipNode.style.backgroundColor = event.target.value;
                }
                input.style.marginLeft = "1rem"
                input.style.marginRight = "0.25rem"
                node.lastChild.appendChild(input);
                creatingEvent = null;
                pendingCreation = false;
            }
        } else if (node.hasAttribute("data-eventid")) { // select event on calendar
            // color task in on calendar
            tryColorEventButton(node, false)
        }
    }

    // recursively check all children too
    node.childNodes.forEach(n => onElementAdded(n));
}

function onElementRemoved(node) {
    if (node.nodeType === Node.ELEMENT_NODE
        && node.hasAttribute("data-taskid")
        && node.parentElement != null
        && node.parentElement.parentElement != null
        && node.parentElement.parentElement.getAttribute("role") === "dialog") {
        editObserver.disconnect();
        editObserver = null;
    }

    // recursively check all children too
    node.childNodes.forEach(n => onElementAdded(n));
}

function colorEventChip(target, color) {
    if (color != null && target != null) {
        if (target.firstChild?.firstChild?.firstChild?.nodeName === "DIV") {
            target.firstChild.firstChild.firstChild.style.borderColor = color;
        } else {
            target.style.borderColor = color;
            if (target.firstChild == null // timed task dot (month)
                || target.childNodes.length === 2 // timed task block (weekly)
            ) {
                target.style.backgroundColor = color;
            } else if (target.childNodes.length === 3) { // schedule view
                target.lastChild.firstChild.firstChild.style.borderColor = color;
            } else {
                target.firstChild.style.backgroundColor = color; // day task background
            }
        }
    }
}

function tryColorEventButton(target, saveColor) {
    let eventId = target.getAttribute("data-eventid");
    if (eventId.length === 52) { // events being created have a longer id
        creatingEvent = eventId
    } else if (eventId.startsWith("tasks_") // check if the event is a task
        && eventId !== "tasks_rollover_view" // check that the button is not a rollover group (past due date)
        && target.hasAttribute("data-eventchip")) {
        let taskId = eventId.substring("tasks_".length); // task id starts after tasks_ prefix
        if (pendingCreation && pendingColor != null && saveColor) {
            setTaskColor(taskId, pendingColor);
            pendingCreation = false;
            pendingColor = null;
            creatingEvent = null;
        }

        if (hasTaskColor(taskId)) {
            colorEventChip(target, getTaskColor(taskId));
        }
    }
}

function getTaskChip(taskId) {
    return getEventChip("tasks_" + taskId);
}

function getEventChip(eventId) {
    return document.querySelector("[data-eventchip][data-eventid=" + eventId + "]");
}

function createColorPickerRow() {
    // <div style="display: flex; flex-direction:row; margin-top: 0.5rem; align-items: center;">
    //     <div style="width: 1em; height: 1em; border-radius: 0.25em; background-color: green; margin-left: 1.75rem; margin-right: 1.6rem"></div>
    //     <input type="color">
    // </div>

    let container = document.createElement("div");
    container.style.display = "flex";
    container.style.flexDirection = "row";
    container.style.marginTop = "0.5rem";
    container.style.alignItems = "center";

    let paletteIcon = document.createElement("i");
    paletteIcon.className = "google-material-icons";
    paletteIcon.textContent = "palette";
    paletteIcon.style.color = "var(--gm3-sys-color-on-surface-variant)";
    paletteIcon.style.fontSize = "20px";
    paletteIcon.style.pointerEvents = "none";
    paletteIcon.style.userSelect = "none";
    paletteIcon.style.marginLeft = "1.5rem";
    paletteIcon.style.marginRight = "1.5rem";
    container.appendChild(paletteIcon);

    let picker = document.createElement("input");
    picker.type = "color"
    picker.value = undefined
    picker.oninput = event => {
        pendingColor = event.target.value;
        pendingCreation = true;
        // update event color in realtime
        if (creatingEvent != null) {
            colorEventChip(getEventChip(creatingEvent), pendingColor);
        }
    }
    container.appendChild(picker);

    return container;
}

function getTaskColor(taskId) {
    return localStorage.getItem("task_color_" + taskId);
}

function hasTaskColor(taskId) {
    return getTaskColor(taskId) !== null;
}

function setTaskColor(taskId, color) {
    return localStorage.setItem("task_color_" + taskId, color);
}

function parseCssColor(colorString) {
    if (colorString.startsWith("rgb(")) {
        let color = 0;
        colorString.substring(4, colorString.length-1).split(", ").forEach(c => {
            color = color << 8;
            color |= Number.parseInt(c);
        })
        return "#" + color.toString(16);
    } else if (colorString.startsWith("#")) {
        return colorString
    }
}

const observer = new MutationObserver(mutations => {
    for (const mutation of mutations) {
        if (mutation.type === "childList") {
            mutation.addedNodes.forEach(node => onElementAdded(node))
            if (editObserver != null) mutation.removedNodes.forEach(node => onElementRemoved(node))
        } else if (mutation.type === "attributes") {
            if (mutation.attributeName === "data-eventid") {
                tryColorEventButton(mutation.target, true);
            } else if (mutation.attributeName === "data-start-date-key" || mutation.attributeName === "data-end-date-key") {
                // view is changing - invalidate event creation
                pendingCreation = false;
                pendingColor = null;
                creatingEvent = null;
            }
        }
    }
});

observer.observe(document.body, {
    attributes: true,
    attributeFilter: ["data-eventid", "data-start-date-key", "data-end-date-key"],
    childList: true,
    subtree: true
});
