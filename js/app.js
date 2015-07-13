(function( $ ) {

	var DB = new Dexie( "bp" );
	DB.version( 1 ).stores({ data: "++id,date,hour,min,max,pulse" } );
	DB.open();

	var Importer = function( element ) {
		this.el = document.querySelector( element );
		this.init();
	};

	Importer.prototype = {
		init: function() {
			this.change();
		},
		change: function() {
			var self = this;
			function readFile( file ) {                                                       
    			var reader = new FileReader();
    			reader.onload = readSuccess;                                            
    			function readSuccess( evt ) {                         
        			var csv = self._parseCSV( evt.target.result );
        			self._insertData( csv );                                
    			}
    			reader.readAsText( file );                                              
			} 

			this.el.addEventListener( "change", function( e ) {
				 var files = e.target.files;
				 var file = files[0];
				 if( !files.length ) {
				 	alert( "Please select a file" );
				 	return;
				 }
				 if( !/csv/.test( file.type ) ) {
				 	alert( "Only CSV files" );
				 	return;
				 }
				 
				 readFile( file );

			}, false);
		},
		_parseCSV: function( str ) {
			var lines = str.split( /\n/ );
			var data = lines.slice( 1, lines.length );
			var items = [];

			for( var i = 0; i < data.length; ++i ) {
				var line = data[i];
				var parts = line.split( "," );
				var d = parts[0];
				var hour = parts[1];
				var max = parts[2];
				var min = parts[3];
				var pulse = parts[4];
				var dateParts = d.split( "/" );
				var day = ( dateParts[0].length == 1 ) ? "0" + dateParts[0] : dateParts[0];
				var month = ( dateParts[1].length == 1 ) ? "0" + dateParts[1] : dateParts[1];
				var year = dateParts[2];
				var date = year + "-" + month + "-" + day;

				var item = {
					date: Date.parse( date ),
					hour: hour,
					max: max,
					min: min,
					pulse: pulse
				};

				items.push( item );
			}

			return items;
		},
		_insertData: function( items ) {
			var total = items.length;

			for( var i = 0; i < total; ++i ) {
				var item = items[i];
				DB.data.add( item );

			}
		}
	};

	var Chart = function() {
		this.init();
	};

	Chart.prototype = {
		init: function() {
			window.renderChart = this.renderChart;
			if( google ) {
				google.load( "visualization", "1", {packages: [ "corechart", "line"] });
				google.setOnLoadCallback( renderChart );
			}
		},
		renderChart: function() {
			var dataArr = [];
				dataArr.push( [ "Day", "Diastolic", "Systolic"] );

				DB.data.orderBy( "date" ).reverse().toArray(function( items ) {
					for( var i = 0; i < items.length; ++i ) {
						var item = items[i];
						var ts = item.date;
						var min = parseInt( item.min, 10 );
						var max = parseInt( item.max, 10 );
						var date = new Date( ts );
						var day = date.getDate();

						var arr = [ day, min, max ];
						dataArr.push( arr );
					}

					var data = google.visualization.arrayToDataTable( dataArr );

					var options = {
          				title: "Blood pressure",
          				curveType: "function",
          				legend: { position: "bottom" }
        			};

        			var chartInst = new google.visualization.LineChart( document.querySelector( "#pressure-diagram" ) );
      				chartInst.draw( data, options );

				});

		}
	};


	$.App = function( element ) {
		this.$el = $( element );
		this.data = [];
		if( this.$el.length ) {
			this.init();
		}
	};

	$.App.prototype = {
		init: function() {
			this.widgets();
			this.save();
			this.localSave();
			this.display();
			this.export();
			this.import();
			this.deleteEntry();

		},
		import: function() {
			var $btn = $( "#import" );
			$btn.click(function() {
				$( "#import-file" ).removeClass( "hidden" );
				return false;
			});
			var imp = new Importer( "#csv" );
		},
		export: function() {
			var csv = "";
			var items = localStorage.getItem( "items" );
			var self = this;

			if( items !== null ) {
				csv += "Date,Hour,Systolic,Diastolic,Pulse" + "\n";
				var itemsArr = JSON.parse( items );
				for( var i = 0; i < itemsArr.length; ++i ) {
					var item = itemsArr[i];
					csv += self._displayDate( item.date )  + ",";
					csv += item.hour + ",";
					csv += item.max + ",";
					csv += item.min + ",";
					csv += item.pulse + "\n";
				}

				var href = "data:text/csv;charset=utf-8," + encodeURIComponent( csv );
				$( "#export" ).attr( "href", href );	
			}
		},
		localSave: function() {
			var storage = localStorage;
			DB.data.orderBy( "date" ).reverse().toArray(function( items ) {
				localStorage.setItem( "items", JSON.stringify( items ) );
			});
		},
		deleteEntry: function() {
			var self = this;
			$( document ).on( "click", ".delete", function( e ) {
				e.preventDefault();
				var $a = $( this ),
					id = $a.data( "id" ),
					yesNo = confirm( "Do you really want to delete this item?" );

					if( yesNo ) {
						DB.data.delete( id );
						self.display();
						self.layout();
						self.localSave();
						self.export();	
					}
			});
		},
		save: function() {
			var self = this;
			$( "#save-form" ).on( "submit", function( e ) {
				e.preventDefault();
				var $form = $( this );
				$( ".error", $form ).hide();
				var validated = self._validate();
				if( validated ) {
					var item = {
						date: Date.parse( $( "#date" ).val() ),
						hour: $( "#hour" ).val(),
						max: $( "#max" ).val(),
						min: $( "#min" ).val(),
						pulse: $( "#pulse" ).val()
					};

					DB.data.add( item );
					self.display();
					self.layout();
					self.localSave();
					self.export();
					$form.reset();
				}
			});
		},
		display: function() {
			var $tableBody = $( "#data-body" );
			var html = "";
			var self = this;
			DB.data.orderBy( "date" ).reverse().toArray(function( items ) {
				for( var i = 0; i < items.length; ++i ) {
					var item = items[i];

					html += "<tr>";
					html += "<td>" + self._displayDate( item.date )  + "</td>";
					html += "<td>" + item.hour + "</td>";
					html += "<td>" + item.max + "</td>";
					html += "<td>" + item.min + "</td>";
					html += "<td>" + item.pulse + "</td>";
					html += "<td><a href='#' data-id='" + item.id + "' class='delete'></a></td>";
					html += "</tr>";
				}	
				$tableBody.html( html );
			});
			
		},
		widgets: function() {
			$( ":text").each(function() {
               $( this ).attr( "autocomplete", "off" );
			});
			$( "#date" ).datepicker({
                   dateFormat: "yy-mm-dd"
            });
            $( "#hour" ).timepicker({
            	show2400: true,
            	step: 1,
            	timeFormat: "H:i:s",
            	scrollDefault: "now"
            });
		},
		_displayDate: function( ts ) {
			var date = new Date( ts );
			var str = date.getFullYear() + "-" + ( date.getMonth() + 1 ) + "-" + date.getDate();
			return str;
		},
		_validate: function() {
			var $date = $( "#date" ),
				$hour = $( "#hour" ),
				$max = $( "#max" ),
				$min = $( "#min" ),
				$pulse = $( "#pulse" ),
				valid = true;

				if( !/^\d{4}-\d{2}-\d{2}$/.test( $date.val() ) ) {
					$date.next().show();
					valid = false;
				}

				if( !/^\d{2}:\d{2}:\d{2}$/.test( $hour.val() ) ) {
					$hour.next().show();
					valid = false;
				}

				if( !/^\d{2,3}$/.test( $max.val() ) ) {
					$max.next().show();
					valid = false;
				}

				if( !/^\d{2,3}$/.test( $min.val() ) ) {
					$min.next().show();
					valid = false;
				}

				if( !/^\d{2,3}$/.test( $pulse.val() ) ) {
					$pulse.next().show();
					valid = false;
				}

				return valid;	
		}
	};

	var pressureDiagram = new Chart();

	$(function() {
		var $app = new $.App( "#app" );

	});

})( jQuery );