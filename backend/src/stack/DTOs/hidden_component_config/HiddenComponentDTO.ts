export interface HiddenComponentDTO {
    context: string,
    section: string,
    component: string,
}

export interface HiddenComponentFinalDTO {
    [context: string]: {
        [section: string]: string[]
    }
}
