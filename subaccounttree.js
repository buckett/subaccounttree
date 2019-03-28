var subaccountsInAdminList = [];	//Recording the subaccounts in the user's admin list (returned by https://canvas.ox.ac.uk/api/v1/accounts.json)
var subaccountsFound = [];	//Recording the subaccounts that have been found down each branch of the tree
var contentDiv = $('div#content');	//The content area of the made
var subaccountCallsMade = 0;	//Counting the API calls made
var subaccountCallsComplete = 0;	//Counting the API calls completed

$(document).ready(function() {
	//Get the URL and split it by '/'
	var url = window.location.href;
	var urlSplit = url.split('/');
	
	//TODO: Is this a robust way of identifying when we are in a subaccount?
	//If we are on an account page...
	if(urlSplit[3] = 'accounts') {
		var menuTabs = $('ul#section-tabs');	//Get the menu list

		//If there is at least one item in the menu (there always should be)...
		if($('li', menuTabs).length > 0) {
			//Create a "View Subaccounts" button and append to the menu
			var menuItem = $('ul#section-tabs li').last().clone();	//Clone the last menu item
			menuItem.empty();	//Empty the last menu item
			menuItem.html('<a title="View Sub-accounts" class="view_subaccounts" tabindex="0" id="view_subaccounts_button" style="cursor: pointer;">View Sub-accounts</a>');
			$('ul#section-tabs').append(menuItem);
			
			//Listen for clicks on the button
			$('#view_subaccounts_button').on('click', function() {
				$('ul#section-tabs li a').removeClass('active');	//Make all buttons inactive
				$(this).addClass("active");	//Make this button active
				
				$('nav#breadcrumbs > ul > li').last().empty().html('<span>View Sub-accounts</span>');	//Replace final breadcrumb with "View sub-accounts"
				
				//Empty the content area then add basic page layout
				contentDiv.empty();
				contentDiv.html('<h1>View Sub-accounts</h1><p id="subaccounts-loading">Please wait, loading your subaccounts...</p><ul id="subaccounts-list-top" style="display: none;"></ul>');
				
				//Get this user's subaccounts list
				$.getJSON('/api/v1/accounts.json?per_page=100', function(subaccounts) {
					//Sort the list by number
					//TODO: This is based on the assumption that subaccounts are numbered from the top (i.e. root = 1, child = 2, grandchild = 3, etc)
					//This is not necessarily the case, as subaccounts that have been moved could disrupt this order
					subaccounts.sort(function(a, b) {
						return a.id - b.id;
					});

					//Loop through subaccounts list
					subaccounts.forEach(function(sa) {
						subaccountsInAdminList.push(sa.id);	//Add to adminlist array
						subaccountsFound[sa.id] = [];	//Create array for this ancestor in subaccountsFound
						var subaccountId = processSubaccountValue(sa.sis_account_id);
						
						var content = createSubaccountListItem(sa.id, sa.id, sa.name, subaccountId);	//Create the list item
						$('ul#subaccounts-list-top', contentDiv).append(content);	//Append the list item to the subaccounts list
						
						iterateChildren(sa.id, sa.id);	//Iterate over the children of this subaccount
					});
				});
			});
		}
	}
});

function processSubaccountValue(subaccountValue) {
	var subaccountId = "";
	if(typeof(subaccountValue) !== "undefined" && subaccountValue !== null) {
		subaccountId = ' - ' + subaccountValue;
	}
	
	return subaccountId;
}

//Create a list item for a subaccount
function createSubaccountListItem(saId, ancestorId, name, subaccountId) {
	//If this is an top level ancestor, i.e. saId == ancestorId, add margin above to separate these on the page
	var style='';
	if(saId == ancestorId) {
		style=' style=" margin-top: 25px"';
	}
	
	//li id = subaccount-:ancestorId-:saId
	//Account URL = /accounts/:saId
	return '<li id="subaccount-' + ancestorId + '-' + saId + '"' + style +'><a href="/accounts/' + saId + '">' + name + '</a>'  + subaccountId + '</li>'; 
}

//Recursively get the children of a subaccount
function iterateChildren(parentId, ancestorId) {
	subaccountCallsMade++;	//We're about to make another API call
	
	//Get all the subaccounts of this account
	$.getJSON('/api/v1/accounts/' + parentId + '/sub_accounts.json?per_page=1000', function(children) {
		//Only do something if there are any children
		if(children.length > 0) {
			//Created new list and append to the parent list item
			var content = '<ul id="subaccounts-list-' + ancestorId + '-' + parentId + '"></ul>';
			$('li#subaccount-' + ancestorId + '-' + parentId, contentDiv).append(content);
			
			//Loop through children
			children.forEach(function(sa) {
				//Add to subaccounts found for this ancestor
				subaccountsFound[ancestorId].push(sa.id);
				var subaccountId = processSubaccountValue(sa.sis_account_id);

				//Create and append list item for this subaccount
				var content = createSubaccountListItem(sa.id, ancestorId, sa.name, subaccountId);
				$('ul#subaccounts-list-' + ancestorId + '-' + parentId, contentDiv).append(content);
				
				//Iterate over this subaccount's children
				iterateChildren(sa.id, ancestorId);
			});
		}
		
		subaccountCallsComplete++;	//Call is complete, so increment counter
		
		//If all the calls are complete...
		if(subaccountCallsMade == subaccountCallsComplete) {
			var subaccountsToSearch = [];	//array of processed subaccounts that will be searched
			
			//Remove the first (lowest number) subaccount from subaccountsInAdminList, as we always want to keep that one
			subaccountsToSearch.push(subaccountsInAdminList.shift()); 
			
			//Loop through the remaining subaccount IDs in subaccountsInAdminList
			subaccountsInAdminList.forEach(function(saId) {
				//If subaccount ID exists in one of the subaccountsToSearch
				if(subaccountsToSearch.some(function(saToSearch) {
					return subaccountsFound[saToSearch].indexOf(saId) > -1;
				})) {
					//Hide the subaccount in the tree
					$('li#subaccount-' + saId + '-' + saId, contentDiv).hide();
				}
				else {
					//Add the subaccount to the subaccounts to search
					subaccountsToSearch.push(saId);
				}
			});
			
			//Hide the loading message and show the subaccounts list
			$('p#subaccounts-loading', contentDiv).hide();
			$('ul#subaccounts-list-top', contentDiv).show();
		}
	});
}