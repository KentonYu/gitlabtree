const CSS_PREFIX = 'gitlab-tree-plugin';

enum EFileState { ADDED, UPDATED, RENAMED, DELETED };

interface IMetadata
{
	type: EFileState; // 'renamed' | 'deleted' | 'edit' | 'new';
	hash: string;
	filename: string;
}

class GitLabTree
{
	pathPrefix: string;
	fileHolders: NodeList;
	fileNames: string[];
	strippedFileNames: string[];
	metadata: IMetadata[];

	wrapperElement: HTMLDivElement = document.createElement( 'div' );
	leftElement: HTMLDivElement = document.createElement( 'div' );
	rightElement: HTMLDivElement = document.createElement( 'div' );
	
	lastActive: string = '';

	hashChangeListener: () => void;


	constructor()
	{
		this.init();


		// Detection if we are on GitLab page

		const isGitLab: Element = document.querySelector( 'meta[content="GitLab"]' );
		if ( ! isGitLab ) { return; }


		// Detection if we have any files to generate tree from

		const files: HTMLElement = document.querySelector( '.files' ) as HTMLElement;
	
		if ( ! files ) { return; }

		this.fileHolders = files.querySelectorAll( '.file-holder' );
		if ( ! files || this.fileHolders.length === 0 ) { return; }

		files.classList.add( CSS_PREFIX );
		this.copyAndHideFiles( files );


		// Obtain metadata

		this.metadata = this.obtainMetadata();
		if ( this.metadata.length === 0 ) { return; }
		const filenames: string[] = this.metadata.map( m => m.filename );


		// Analyze filenames

		this.fileNames = filenames;
		this.pathPrefix = this.getPrefixPath( this.fileNames );
		this.strippedFileNames = this.removePathPrefix( this.fileNames, this.pathPrefix );



		// Create and display DOM

		const fileNamesDOM: HTMLDivElement = this.convertFolderStructureToDOM( this.pathPrefix, this.createFolderStructure( this.strippedFileNames ) )

		this.leftElement.appendChild( fileNamesDOM )
		files.appendChild( this.wrapperElement );


		// Show file based on hash id

		const currentFileHash: string = location.hash;
		this.showFile( currentFileHash );


		// Add listener for changes

		this.hashChangeListener = this.hashChanged.bind( this )
		window.addEventListener( 'hashchange', this.hashChangeListener );
	}


	/**
	 * Kind of destructor.
	 */
	teardown(): void
	{
		window.removeEventListener( 'hashchange', this.hashChangeListener );
	}

	
	/**
	 * Creates required DOM elements.
	 */
	init(): void
	{
		this.wrapperElement.appendChild( this.leftElement );
		this.wrapperElement.appendChild( this.rightElement );

		this.wrapperElement.classList.add( CSS_PREFIX + '-wrapper' );
		this.leftElement.classList.add( CSS_PREFIX + '-left' );
		this.rightElement.classList.add( CSS_PREFIX + '-right' );
	}

	/**
	 * Collects basic information about files - their names, their hashes, and happend to them.
	 * 
	 * @return {IMetadata} - collected metadata
	 */
	obtainMetadata(): IMetadata[]
	{
		let metadata: IMetadata[] = [];
		let rawFilesMetadata: HTMLElement[] = Array.prototype.slice.call( document.querySelectorAll( '.file-stats li' ));

		for ( let rawFileMetadata of rawFilesMetadata )
		{
			const typeRaw: string[] = Array.prototype.slice.call( rawFileMetadata.querySelector(  'span:first-child' ).classList );
			const hash: string = rawFileMetadata.querySelector( 'a' ).getAttribute('href');
			let filename: string = rawFileMetadata.querySelector( 'a' ).textContent.trim();
			let type: EFileState = EFileState.UPDATED;;
			

			// When file renamed, show renamed file

			if ( filename.indexOf('→') !== -1 )
			{
				filename = filename.split( '→' )[1].trim();
			}


			// Convert type

			if ( ~typeRaw.indexOf( 'add-file' )) { type = EFileState.ADDED;	}
			if ( ~typeRaw.indexOf( 'renamed-file' )) { type = EFileState.RENAMED; }
			if ( ~typeRaw.indexOf( 'deleted-file' )) { type = EFileState.DELETED; }


			// Save

			const fileMetadata: IMetadata = { type, hash, filename };
			metadata.push( fileMetadata );
		}

		return metadata;
	}


	/**
	 * Returns metadata by index.
	 * 
	 * @param {number} index - index
	 * @return {IMetadata} - metadata
	 */
	getMetadata( index: number ): IMetadata
	{
		return this.metadata[ index ];
	}


	/**
	 * It loops through files listed (DOM elements), copies them to new DOM structure,
	 * and hides them.
	 * 
	 * @param {HTMLElement} files - DOM element with files listed
	 */
	copyAndHideFiles( files: HTMLElement ): void
	{
		for ( let i: number = 0; i < this.fileHolders.length; i++ )
		{
			let fileHolder: HTMLElement = this.fileHolders[i] as HTMLElement;
			files.removeChild( fileHolder );
			this.rightElement.appendChild( fileHolder );

			fileHolder.classList.add( CSS_PREFIX + '-hidden' );
		}
	}


	/**
	 * It loops through files finding maximum common folder structure.
	 * 
	 * @param {string[]} fileNames - list of filenames
	 * @return {string} - maximum common folder path
	 */
	getPrefixPath( fileNames: string[] ): string
	{
		if ( ! Array.isArray( fileNames ))
		{
			throw new Error( `Expected array, ${ typeof fileNames } given!` );
		}

		if ( fileNames.length === 0 )
		{
			return '';
		}

		let sourcePathParts: string[] = fileNames[0].split('/');

		if ( fileNames.length === 1 )
		{
			sourcePathParts.pop();
			return sourcePathParts.join('/');
		}

		for ( let i: number = 1; i < fileNames.length; i++ )
		{
			let filePathParts: string[] = fileNames[i].split( '/' );

			for ( let ii: number = 0; ii < sourcePathParts.length; ii++ )
			{
				if ( sourcePathParts[ ii ] !== filePathParts[ ii ] )
				{
					sourcePathParts = sourcePathParts.slice( 0, ii );
					break;
				}
			}
		}

		return sourcePathParts.join('/');
	}


	/**
	 * Removes path prefix from all fileNames.
	 * 
	 * @param {string[]} fileNames - list of filenames
	 * @param {string} prefix - prefix to be removed
	 * @return {string[]} - trimmed filenames
	 */
	removePathPrefix( fileNames: string[], prefix: string ): string[]
	{
		if ( prefix.length === 0 )
		{
			return fileNames.slice( 0 );
		}

		let output: string[] = [];

		for ( let fileName of fileNames )
		{
			output.push( fileName.substring( (prefix + '/').length ) )
		}

		return output;
	}


	/**
	 * Creates folder structure from given list of files.
	 * Folders are objects, files are numbers.
	 * 
	 * Example: [ test/foo/spec1.ts, test/foo/spec2.ts ] -> { test: { foo: { spec1: 0, spec1: 1 }}}
	 * 
	 * @param {string} fileNames - list of filenames
	 * @return {any} generated folder structure
	 */
	createFolderStructure( fileNames: string[] ): any
	{
		let structure: any = {};

		if ( ! Array.isArray( fileNames ) || fileNames.length === 0 )
		{
			throw new Error( `Expected array, ${ typeof fileNames } given!` );
		}

		for ( let i: number = 0; i < fileNames.length; i++ )
		{
			let fileName: string = fileNames[ i ];
			let fileNameParts: string[] = fileName.split('/');

			let currentFolder: any = structure;

			for ( let ii: number = 0; ii < fileNameParts.length; ii++ )
			{
				let part: string = fileNameParts[ ii ];

				if ( ! currentFolder[ part ] )
				{
					if ( ii === fileNameParts.length - 1 ) // is last one
					{
						currentFolder[ part ] = i; // file
					}

					else
					{
						currentFolder[ part ] = {}; // folder
					}
				}

				currentFolder = currentFolder[ part ];
			}
		}

		return structure;
	}


	/**
	 * Converts folder structure into DOM recursively.
	 * 
	 * @param {string} folderName - name of the currently proceed folder
	 * @param {string} structure - folder structure (for example see `createFolderStructure`)
	 * @return {HTMLDivElement} corresponding folder structure
	 */
	convertFolderStructureToDOM( folderName: string, structure: any ): HTMLDivElement
	{
		let root: HTMLDivElement = document.createElement( 'div' );
		root.classList.add( 'folder' );

		let holder: HTMLDivElement = document.createElement( 'div' );
		holder.classList.add( 'holder' );
		holder.setAttribute( 'title', folderName );
		holder.textContent = folderName;
		root.appendChild( holder );

		let files: HTMLAnchorElement[] = [];
		let folders: HTMLDivElement[] = [];

		for ( let name in structure )
		{
			if ( structure.hasOwnProperty( name ) )
			{
				let entry: any = structure[ name ];

				if ( typeof entry === 'number' )
				{
					const metadata = this.getMetadata( entry );
					let file: HTMLAnchorElement = document.createElement( 'a' );
					file.setAttribute( 'href', metadata.hash );
					file.classList.add( 'file' );
					file.textContent = name;

					let fileStateClass;
					switch ( metadata.type )
					{
						case EFileState.ADDED: fileStateClass = CSS_PREFIX + '-file-added'; break;
						case EFileState.RENAMED: fileStateClass = CSS_PREFIX + '-file-renamed'; break;
						case EFileState.DELETED: fileStateClass = CSS_PREFIX + '-file-deleted'; break;
						default: fileStateClass = CSS_PREFIX + '-file-updated'; break;
					}

					file.classList.add( fileStateClass );
					files.push( file );
				}

				else
				{
					folders.push( this.convertFolderStructureToDOM( name, entry ) );
				}
			}
		}

		folders.forEach(( folder: HTMLDivElement ) => root.appendChild( folder ));
		files.forEach(( file: HTMLAnchorElement ) => root.appendChild( file ));

		return root;
	}


	/**
	 * Callback called after hash has changed. It searches for "diff-[FILE ID]"" in hash,
	 * and displays corresponding file (based on id). 
	 */
	hashChanged(): void
	{
		let newHash: string = location.hash;
		this.showFile( newHash );
	}


	/**
	 * Shows file based on id.
	 * 
	 * @param {number} id - id of file to be shown
	 */
	showFile( hash?: string ): void
	{
		if ( this.metadata.length === 0 )
		{
			return;
		}

		if ( this.lastActive )
		{
			this.getFileHolderByHash( this.lastActive ).classList.add( CSS_PREFIX + '-hidden' );
			this.getFileLinkByHash( this.lastActive ).classList.remove( CSS_PREFIX + '-file-active' );
		}
		
		
		hash = this.metadata.filter( m => m.hash === hash ).length > 0 ? hash : this.metadata[0].hash; // if hash is invalid use default hash

		this.getFileHolderByHash( hash ).classList.remove( CSS_PREFIX + '-hidden' );
		this.getFileLinkByHash( hash ).classList.add( CSS_PREFIX + '-file-active' );

		this.lastActive = hash;
	}

	getFileHolderByHash( hash: string ): HTMLElement
	{
		return this.rightElement.querySelector( `[id='${ hash.substr(1) }']` ) as HTMLElement;
	}

	getFileLinkByHash( hash: string ): HTMLElement
	{
		return this.leftElement.querySelector( `[href='${ hash }']` ) as HTMLElement;
	}
}



let instance: GitLabTree = new GitLabTree();

/**
 * This is for fake AJAX re-renders of the page.
 */
function checkSiteChange(): void
{
	let files: Element = document.querySelector( '.files' );

	if ( files && ! files.classList.contains( CSS_PREFIX ) )
	{
		instance.teardown();
		instance = new GitLabTree();
	}
}

setInterval( () => checkSiteChange(), 3000 )