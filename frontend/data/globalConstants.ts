import sharedConstants from '../../shared_constants.json'; // frontend symlink - the true file is in the backend root for simpler backend deployment

type Constants = {
    MAX_USER_FILE_NUM: number;
    MAX_USER_FOLDER_NUM: number;
    APP_PATH_LIMIT: number;

    MAX_ITEM_NUM_ERR_MSG: string;
    DUPLICATE_NAME_ERR_MSG: string;
    ACCOUNT_STORAGE_CAP_ERR_MSG: string;

    INVALID_ITEM_NAME_CHARS: string;
};

const constants: Constants = sharedConstants; // This may show error even if the json matches the type

export { constants };

// If adding a new constant, cut and repaste the import/restart the server