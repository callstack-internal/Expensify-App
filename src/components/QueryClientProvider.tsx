import {QueryClientProvider as TanstackQueryProvider} from '@tanstack/react-query';
import React from 'react';
import queryClient from '@libs/queryClient';

type Props = {
    children?: React.ReactNode;
};

function QueryClientProvider({children}: Props) {
    return <TanstackQueryProvider client={queryClient}>{children}</TanstackQueryProvider>;
}

export default QueryClientProvider;
