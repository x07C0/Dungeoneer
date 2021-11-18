const ElementCreator = require("../js/lib/elementCreator");

class ShopGenerator {
    initialize(generatorData, container, resultContainer) {
        this.generatorData = generatorData;
        this.container = container;
        this.resultContainer = resultContainer;
        var cls = this;
        document.getElementById("reroll_shop_button").addEventListener("click", function (devt) {
            dataAccess.getItems(data => cls.generateShop(data, false));
        });


        document.querySelector("#generate_shop_button").addEventListener("click", function () {
            dataAccess.getItems(function (data) {
                document.getElementById("reroll_shop_button").classList.remove("hidden");
                cls.generateShop(data, true);
            });

        });

        this.sortDirections = [false, false, false]
        this.keys = ["Name", "Rarity", "Price"]
        this.switchFunctions = [,]
    }


    generateShop(itemData, generateDescription) {
        var shopWealthDropdown = document.querySelector("#shop_wealth");
        var shopWealth = shopWealthDropdown.selectedIndex;
        var shopTypeDropdown = document.querySelector("#shop_type");
        var shopType = shopTypeDropdown.options[shopTypeDropdown.selectedIndex].value;
        var shopSizeDropdown = document.querySelector("#shop_size");
        var shopSize = shopSizeDropdown.selectedIndex;
        shopSize++;
        var shopPricingDropdown = document.querySelector("#shop_pricing");
        var shopPricing = shopPricingDropdown.options[shopPricingDropdown.selectedIndex].value;
        shopPricing = parseFloat(shopPricing);
        var currentRarity;

        var shopInventoryArray = [];
        this.tooltipsForTable = [];
        var cls = this;
        var shopInventory = {};
        shopInventory.Name = [];
        shopInventory.Rarity = [];
        shopInventory.Price = [];
        dataAccess.getScrolls(function (scrollData) {
            if (shopType.toLowerCase() != "general") {
                if (shopType === "scroll") {
                    itemData = scrollData;
                } else {
                    itemData = typeFilter(itemData, shopType)
                }
                //Velja nokkur scroll til að henda inn í  
            } else {
                var currentScrollRarity;

                for (var i = 0; i <= shopWealth; i++) {
                    currentScrollRarity = [];
                    for (var j = 0; j < scrollData.length; j++) {
                        if (evaluateRarity(scrollData[j].rarity) == i) {
                            currentScrollRarity.push([scrollData[j].name, scrollData[j].rarity, scrollData[j].type, { description: scrollData[j].description }])

                        }
                    }
                    var chosen = pickX(currentScrollRarity, shopSize * (d(2) - 1));
                    shopInventoryArray = shopInventoryArray.concat(chosen);
                }



            }
            for (var i = 0; i <= shopWealth; i++) {
                currentRarity = [];
                for (var j = 0; j < itemData.length; j++) {
                    if (evaluateRarity(itemData[j].rarity) == i) {
                        currentRarity.push([itemData[j].name, itemData[j].rarity, itemData[j].type,
                        {
                            description: itemData[j].description,
                            attunement: (itemData[j].requires_attunement ? `(requires attunement${itemData[j].requires_attunement_by ? " " + itemData[j].requires_attunement_by : ""})` : "")
                        }])
                    }

                }
                chosen = pickX(currentRarity, shopSize * d(4));
                shopInventoryArray = shopInventoryArray.concat(chosen);
            }

            shopInventoryArray.sort(function (a, b) {

                if (a[0] < b[0]) return -1;
                if (a[0] > b[0]) return 1;
                return 0;
            });
            var str;

            for (var i = 0; i < shopInventoryArray.length; i++) {

                str = shopInventoryArray[i][3];
                if (str.length > 1200) {
                    str = str.substring(0, 1200);
                    str = str.substring(0, str.lastIndexOf(" ")) + " ...";
                }

                var tooltip = str.attunement ? `-- ${str.attunement} -- \n\n ${str.description.replace(/\*/g, " -- ")}` : str.description.replace(/\*/g, " -- ");
                cls.tooltipsForTable.push(tooltip);
                shopInventoryArray[i].splice(3, 1);
            }

            shopInventoryArray.forEach(function (subArray) {
                shopInventory.Name.push(subArray[0])
                shopInventory.Rarity.push(subArray[1]);
                var price = randomizeItemPrice(subArray[1]); ///Finna viðeigandi randomized verð
                if (subArray[2].toLowerCase() === "potion" || subArray[2].toLowerCase() === "scroll") {
                    price /= 2;
                }
                price *= shopPricing;
                shopInventory.Price.push(makePrettyPriceString(price));
            });

            cls.shopInventoryObject = shopInventory;
            cls.emptyAndCreateTable();
            if (generateDescription) cls.generateShopDescription(shopType, shopWealth, shopInventory.Price.length);

        });
    }

    emptyAndCreateTable() {
        var shopInventory = this.shopInventoryObject;
        var table = ElementCreator.generateHTMLTable(shopInventory);
        var nameFields = table.querySelectorAll("td:first-of-type");
        for (var i = 0; i < nameFields.length; i++) {
            nameFields[i].classList.add("tooltipped", "tooltipped_large");
            nameFields[i].setAttribute("data-tooltip", this.tooltipsForTable[i])
        }
        var tableContainer = document.querySelector("#shop_generator_table");
        while (tableContainer.firstChild) {
            tableContainer.removeChild(tableContainer.firstChild);
        }
        tableContainer.setAttribute("data-shop_inventory", JSON.stringify(shopInventory));
        tableContainer.appendChild(table)



        var headers = document.querySelectorAll("th");
        for (var i = 0; i < headers.length; i++) {
            headers[i].addEventListener("click", this.sortByHeaderValue);
        }
    }


    sortByHeaderValue() {
        var rows, switching, i, x, y, shouldSwitch, switchcount = 0;
        var n = keys.indexOf(this.innerHTML)

        if (n < 2) {
            this.switchFunction = function (x, y) { return x.innerHTML.toLowerCase() > y.innerHTML.toLowerCase() }
        } else {
            this.switchFunction = function (x, y) { return parseInt(undoPrettyPriceString(x.innerHTML)) > parseInt(undoPrettyPriceString(y.innerHTML)) }
        }
        switching = true;
        this.sortDirections[n] = true;
        while (switching) {
            switching = false;
            rows = document.querySelectorAll("#shop_generator_table>table>tbody>tr");

            for (i = 0; i < rows.length - 1; i++) {
                shouldSwitch = false;
                x = rows[i].getElementsByTagName("TD")[n];

                y = rows[i + 1].getElementsByTagName("TD")[n];

                if (sortDirections[n]) {
                    if (this.switchFunction(x, y)) {
                        shouldSwitch = true;
                        break;
                    }
                } else if (!sortDirections[n]) {
                    if (this.switchFunction(y, x)) {
                        shouldSwitch = true;
                        break;
                    }
                }
            }
            if (shouldSwitch) {
                rows[i].parentNode.insertBefore(rows[i + 1], rows[i]);
                switching = true;
                // Each time a switch is done, increase this count by 1:
                switchcount++;
            } else {
                /* If no switching has been done AND the direction is "asc",
                set the direction to "desc" and run the while loop again. */
                if (switchcount == 0 && sortDirections[n]) {
                    this.sortDirections[n] = false;
                    switching = true;
                }
            }
        }

    }
    generateShopDescription(shopType, shopWealth, inventorySize) {
        shopType = shopType.serialize();
        var data = this.generatorData;

        var randomIndex = Math.floor(Math.random() * data.shops.names.template.length);

        var shopOwner;
        var shopName = "" + data.shops.names.template[randomIndex];
        var fantasyProbability = 0.1 + 0.1 * shopWealth;
        var rand = Math.random();
        var descriptionSet, clutterSet, locationSet;
        //Interior speisaður
        if (rand < fantasyProbability) {
            descriptionSet = data.shops.interior.description_fantastic[shopWealth];
            clutterSet = data.shops.interior.clutter_fantastic;
        } else {
            descriptionSet = data.shops.interior.description[shopWealth];
            clutterSet = data.shops.interior.clutter;
        }

        //staðsetning speisuð
        rand = Math.random();
        var creatureType = "humanoid";
        var ownerGender = pickOne(["male", "female"]);
        if (rand < fantasyProbability) {
            locationSet = data.shops.location_fantastic;
            var nameset;
            creatureType = pickOne(["celestial", "fey", "aberration", "fiend", "humanoid"])
            if (creatureType === "humanoid") {
                nameset = "anglo";
            } else {
                nameset = creatureType;
            }

            shopOwner = generateNPC(data, ownerGender, data.names[nameset], creatureType);

        } else {
            locationSet = data.shops.location;
            shopOwner = generateNPC(data, ownerGender, data.names.anglo, "humanoid");
        }

        var ownerLastName;
        if (shopOwner.lastname) {
            ownerLastName = shopOwner.lastname;
        } else {
            ownerLastName = shopOwner.firstname;
        }


        var ownerName = randomIndex >= 1 ? shopOwner.firstname : ownerLastName;
        var ending = "'s";
        if (ownerName.substring(ownerName.length - 1) === "s") ending = "'";
        shopName = shopName.replace(/_typeboundname/g, pickOne(data.shops.names.typeboundname[shopType]));
        shopName = shopName.replace(/_typebound/g, pickOne(data.shops.names.typebound[shopType]));

        shopName = shopName.replace(/_wealthbound/g, pickOne(data.shops.names.wealthbound[shopWealth]));
        shopName = shopName.replace(/_name/g, ownerName + ending);
        shopName = shopName.replace(/_adjective/g, pickOne(data.shops.names.adjective));

        shopName = shopName.replace(/_wares/g, pickOne(data.shops.names.wares[shopType]));
        shopName = shopName.replace(/_surname/g, ownerLastName + ending);

        shopName = replacePlaceholders(shopName, null, data);
        var descriptionBox = document.querySelector("#shop_description");
        var headerBox = document.querySelector("#shop_name");
        headerBox.classList.remove("hidden");
        shopName = shopName.toProperCase();

        var description = "<strong>" + shopName + "</strong>" + pickOne([" is located", " is situated", " can be found", " is placed "]) + pickOne(locationSet) + ". ";
        description = description.replace(/_roominhouse/g, pickOne(data.roominhouse));
        if (description.includes("!nointerior")) {
            description = description.replace(/!nointerior/g, "");
        } else {
            description += "The interior of the shop is " + pickOne(descriptionSet) + ". "
                + pickOne(clutterSet) + "."
            description = description.replace(/_material/g, pickOne(data.material[shopWealth]));
            description = description.replace(/_metal/g, pickOne(data.metals));
            description = description.replace(/_element/g, pickOne(["earth", "fire", "water", "air"]));
            description = description.replace(/_inventory/g, pickOne(["inventory is", "merchandise is", "stock is"]));
            description = description.replace(/_inventorypl/g, pickOne(["wares are", "commodities are", "goods are"]));
            description = description.replace(/_figures/g, pickOne(data.figures));
            description = description.replace(/_color/g, pickOne(data.color));
            if (shopWealth < 2 && inventorySize < 10) {
                var waresString;
                if (shopType === "potion") {
                    waresString = "medicinal and magical herbs, useful for crafting potions, "
                } else if (shopType === "weapon") {
                    waresString = "nonmagical but finely crafted weapons"
                } else if (shopType === "scroll") {
                    waresString = "rare tomes and books containing various lore"
                } else if (shopType === "item") {
                    waresString = "rare jewels and wondrous item ingreidents"
                } else {
                    waresString = "various adventuring gear"
                }
                description += "<br><br> In addition to the items displayed in the magic item table, the shop has " + waresString + " for sale. "
            }
        }



        var creatureString, commaString;
        if (creatureType === "humanoid") {
            creatureString = "";
            commaString = "";
        } else {
            if (ownerGender === "male") {
                creatureString = " is a " + creatureType + ". He ";
                commaString = "";
            } else {
                creatureString = " is a " + creatureType + ". She ";
                commaString = "";
            }

        }
        var ownerName = shopOwner.lastname;
        if (ownerName) ownerName = " " + ownerName;
        description += "<br><br>The owner, " + shopOwner.firstname + (ownerName || "") + "," + creatureString + commaString + shopOwner.shopKeepDescription;
        headerBox.innerText = shopName;
        headerBox.classList.remove("hidden");

        descriptionBox.innerHTML = description;

    }

}

module.exports = ShopGenerator;

