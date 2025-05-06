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

// event colours are stored in local storage
// format: task_color_<task id> -> <color>

// globals to keep track of colour being set
let pendingColour = null;
let creatingEvent = null;
let pendingCreation = false;
let editObserver = null;

function onElementAdded(node) {
    if (node.nodeType === Node.ELEMENT_NODE) {
        if (node.getAttribute("aria-labelledby") === "tabTask") { // task creation dialog
            // add colour selector to new task screen
            let input = document.createElement("input");
            input.type = "color";
            input.oninput = event => {
                pendingColour = event.target.value;
                pendingCreation = true;
                // update event colour in realtime
                if (creatingEvent != null) {
                    let target = getEventChip(creatingEvent);
                    if (target) colourEventChip(pendingColour, target);
                }
            }
            input.style.marginLeft = "4.25rem"
            input.style.marginTop = "0.5rem"
            node.appendChild(input)
        } else if (node.hasAttribute("data-taskid")) { // select task view dialog
            if (node.parentElement != null
                && node.parentElement.parentElement != null
                && node.parentElement.parentElement.getAttribute("role") === "dialog") {
                if (editObserver != null) {
                    editObserver.nextDisconnect = true;
                    editObserver = null;
                }

                let taskId = node.getAttribute("data-taskid")
                if (localStorage.getItem("task_color_" + taskId) != null) {
                    // colour the dot in the task view dialog (one click)
                    node.childNodes.item(1).firstChild.firstChild.firstChild.firstChild.style.backgroundColor = localStorage.getItem("task_color_" + taskId)
                }

                // create edit colour button
                let input = document.createElement("input");
                input.type = "color";
                if (localStorage.getItem("task_color_" + taskId) != null) {
                    input.value = localStorage.getItem("task_color_" + taskId);
                    // in week view, style is manually updated on click (with timed tasks) - counteract changes
                    colourEventChip(input.value, getTaskChip(taskId))

                    let observer = new MutationObserver(_ => {
                        colourEventChip(input.value, getTaskChip(taskId))
                        if (observer.nextDisconnect) {
                            observer.disconnect();
                        }
                    });
                    observer.observe(getTaskChip(taskId), {
                        attributes: true,
                        attributeFilter: ["style"],
                    });
                    editObserver = observer
                }

                input.oninput = event => {
                    localStorage.setItem("task_color_" + taskId, event.target.value);
                    colourEventChip(event.target.value, getTaskChip(taskId));
                }
                input.style.marginLeft = "1rem"
                input.style.marginRight = "0.25rem"
                node.lastChild.appendChild(input);
                creatingEvent = null;
                pendingCreation = false;
            }
        } else if (node.hasAttribute("data-eventid")) { // select event on calendar
            // color task in on calendar
            tryColourEventButton(node, false)
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

function colourEventChip(colour, target) {
    if (colour != null) {
        if (target.firstChild?.firstChild?.firstChild?.nodeName === "DIV") {
            target.firstChild.firstChild.firstChild.style.borderColor = colour;
        } else {
            target.style.borderColor = colour;
            if (target.firstChild == null // timed task dot (month)
                || target.childNodes.length === 2 // timed task block (weekly)
            ) {
                target.style.backgroundColor = colour;
            } else if (target.childNodes.length === 3) { // schedule view
                target.lastChild.firstChild.firstChild.style.borderColor = colour;
            } else {
                target.firstChild.style.backgroundColor = colour; // day task background
            }
        }
    }
}

function tryColourEventButton(target, set) {
    let eventId = target.getAttribute("data-eventid");
    if (eventId.length === 52) { // events being created have a longer id
        creatingEvent = eventId
    } else if (eventId.startsWith("tasks_") // check if the event is a task
        && eventId !== "tasks_rollover_view" // check that the button is not a rollover group (past due date)
        && target.hasAttribute("data-eventchip")) {
        eventId = eventId.substring("tasks_".length); // task id starts after tasks_ prefix
        if (pendingCreation && pendingColour != null && set) {
            localStorage.setItem("task_color_" + eventId, pendingColour);
            pendingCreation = false;
            pendingColour = null;
            creatingEvent = null;
        }
        if (localStorage.getItem("task_color_" + eventId) != null) {
            let colour = localStorage.getItem("task_color_" + eventId)
            colourEventChip(colour, target);
        }
    }
}

function getTaskChip(taskId) {
    return getEventChip("tasks_" + taskId);
}

function getEventChip(eventId) {
    return document.querySelector("[data-eventid=" + eventId + "]");
}

const observer = new MutationObserver(mutations => {
    for (const mutation of mutations) {
        if (mutation.type === "childList") {
            mutation.addedNodes.forEach(node => onElementAdded(node))
            if (editObserver != null) mutation.removedNodes.forEach(node => onElementRemoved(node))
        } else if (mutation.type === "attributes") {
            if (mutation.attributeName === "data-eventid") {
                tryColourEventButton(mutation.target, true);
            } else if (mutation.attributeName === "data-start-date-key" || mutation.attributeName === "data-end-date-key") {
                pendingCreation = false;
                pendingColour = null;
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
