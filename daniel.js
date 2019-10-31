class Daniel {
  constructor(object) {
    let renderInitTime = Date.now();
    window.daniel = this; // to bugfix this class
    // First of all we need to provide the element that is rendered by this class
    if (!object.el) {
      console.error("Daniel.js needs to have an el-variable");
      return;
    }
    this.baseElement = object.el; // Save the Id of the Base-Element
    this.template = document.querySelector(object.el).innerHTML; // Save the HTML template of the base element
    this.element = document.querySelector(object.el); // Store the root element
    this.data = object.data ? object.data : null; // Save the data variables if provided

    this.__overrideData(); // New: Add some getters and setters to get reactivity

    this.$render(this.element); // Render the content of the element nodes

    // We have reached the mounted lifecycle
    // If mounted is set, then use the given function, otherwise set it to an empty function
    this.mounted = object.mounted ? object.mounted : () => {};
    this.mounted();

    // Let's see how long this will take to render
    console.log(
      `DanielJS finished rendering in ${(Date.now() - renderInitTime) / 1000}s`
    );
  }

  // The render loop to actually alter the basic HTML template
  $render(rootElement) {
    for (let el of rootElement.children) {
      // Check if there are some child elements
      let childCount = el.childElementCount;

      // Check for framework specific attributes
      el = this.__checkForAttributes(el);

      if (childCount > 0) el = this.$render(el); // Go one instance deeper
      if (childCount === 0) {
        // Check the inner Text
        el = this.__displayData(el);
      }
    }
  }

  // Update to rerender the HTML template from scratch...
  $update() {
    // Get the element of the actual template
    let actualElement = document.querySelector(this.baseElement);
    // Create a new element with the same type
    let newElement = document.createElement(actualElement.nodeName);
    // Give this element the same id
    newElement.id = this.baseElement.replace("#", "");
    // Rebuild this element innerHTML from the template
    newElement.innerHTML = this.template;
    // Add this element to the dom
    actualElement.parentElement.insertBefore(
      newElement,
      actualElement.parentElement.children[
        Array.from(actualElement.parentElement.children).indexOf(actualElement)
      ]
    );
    // Remove the already renedered element
    actualElement.parentElement.removeChild(actualElement);
    // Make the new element the reference for this class
    this.element = newElement;
    // Render again
    this.$render(this.element);
  }

  // MAGIC IS HAPPENING HERE
  // Take the initial provided data object from the constructor
  // Trigger an update everytime a value changes
  __overrideData() {
    let vm = this; // Just for the clearance
    for (let i in vm.data) {
      // Iterate through every variable in the data object
      Object.defineProperty(vm, i, {
        // Define the setter to actually trigger the $update function
        set: val => {
          vm.data[i] = val; // Save to the initial data object
          vm.$update(); // Trigger update
        },
        get: () => {
          return vm.data[i]; // Return the value of the inital data object
        }
      });
    }
  }

  // Use regex to find placeholders
  __getPlaceholders(string) {
    return string.match(/{{\s?[A-Za-z0-9_-]+\s?}}/g); // Match any string containing {{}}
  }

  // Manipulate the string to only get the name of the placeholder
  __cleanUpPlaceholder(placeholder) {
    return placeholder
      .replace("{{", "")
      .replace("}}", "")
      .trim();
  }

  // Replace all suitable Text in {{}} with a variable if possible
  __displayData(el) {
    let textNodes = this.__getPlaceholders(el.innerText); // Check the inner text of the variable for placeholders
    if (!textNodes) return;
    for (let textNode of textNodes) {
      // Get the variable from the placeholder
      let lookupVariable = this.__cleanUpPlaceholder(textNode); // Remove curly braces and white spaces

      // If we find an actual variable for the placeholder, display the string stored in the variable
      // Otherwise just return the placeholder
      if (this[lookupVariable]) {
        el.innerText = el.innerText.replace(
          textNode,
          this[lookupVariable].toString()
        );
      }
    }
    return el;
  }

  // Check for framework-specific attributes
  __checkForAttributes(el) {
    if (el.attributes.length < 1) return el; // If there aren't any attributes, just go on
    for (let attribute of el.attributes) {
      let attributeName = attribute.name; // Get the name of the attribute
      let attributeContent = attribute.textContent;
      // Placeholder for more attributes you could possibly implement
      switch (attributeName) {
        case "d-for":
          el = this.__handleForLoop(el, attributeContent);
          break;
      }
    }
    return el;
  }

  // Handle For Loop
  __handleForLoop(el, attributeContent) {
    // Check for the "in" keyword in the statement
    let statementHasInKeyWord = attributeContent.match(/(\sin\s)/g);
    // Get the parts split by the "in" keyword
    let statementParts = attributeContent.match(
      /\b((?!in)[^\s][A-Za-z0-9-_]+?)\b/g
    );
    if (
      !statementHasInKeyWord ||
      statementHasInKeyWord.length > 1 ||
      statementParts > 2
    ) {
      console.warn("Error handling d-for statement...");
      return el;
    }
    let displayValue = el.innerText; // Get inner text of the element to display the variable
    let variableIdentifier = statementParts[0].trim(); // Identifier of the for loop
    let variableRoot = statementParts[1].trim(); // Root variable to be looped
    if (!this.data[variableRoot]) {
      console.warn("Error handling d-for statement...");
      console.warn(`${variableRoot} not found`);
      return el;
    }
    // Get the real data to loop through
    let loopData = this[variableRoot];
    // Loop through the loop data
    let generatedNodes = []; // The new nodes to append
    for (let i in loopData) {
      // Create the new element with the same type as the placeholder
      let newElement = document.createElement(el.nodeName);
      // Get all placeholders in the displayValue
      let displayValuePlaceholders = this.__getPlaceholders(displayValue);
      if (!displayValuePlaceholders) {
        console.warn(`No valid placeholder found for ${displayValue}`);
        return el;
      }
      // The would make no sense for an object... the whole object would be returned
      if (Array.isArray(loopData)) {
        for (let ph of displayValuePlaceholders) {
          let cleanPh = this.__cleanUpPlaceholder(ph); // Clean up the found placeholders
          // The new element has the same content as the placeholder element containing the same placeholders
          newElement.innerText = displayValue;
          // if there is a placeholder with the actual name of the loop-element, replace it!
          if (cleanPh === variableIdentifier)
            // I used inner HTML here, to get rid of not having linebreaks etc.
            newElement.innerHTML = newElement.innerHTML.replace(
              ph,
              loopData[i]
            );
        }
      }
      // TODO: what if it is an object and we have specific placeholders for subelements of the object?
      else {
        return el;
      }
      generatedNodes.push(newElement);
    }

    // Locate the parent element
    let parentElement = el.parentElement;
    for (let newElement of generatedNodes) {
      // Get the position of the initial element in the parent element
      let pos = Array.from(parentElement.children).indexOf(el);
      // Add the new items to the element right BEFORE the placeholder element
      parentElement.insertBefore(newElement, parentElement.children[pos]);
    }

    // Remove the initial placeholder element
    el.parentElement.removeChild(el);

    return el;
  }

  // Simple example of a static getting returning the version
  static get version() {
    return "0.2.0";
  }
}

// Just a little health gimmick to show me that the library has loaded correctly
console.log(`You are running DanielJS v${Daniel.version} in your browser`);
